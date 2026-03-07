require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize YouTube API client
const youtube = google.youtube({
  version: "v3",
  auth: process.env.GOOGLE_API_KEY, // Note: User must have a valid API Key in .env
});

// Helper: Extract YouTube Video ID from URL
function extractYouTubeVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Helper: Resolve Google News RSS link to actual URL
async function resolveGoogleNewsUrl(googleNewsUrl) {
  try {
    if (!googleNewsUrl.includes("news.google.com")) return googleNewsUrl;
    
    // Launch headless browser to follow JS redirects
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    // Set a timeout to prevent hanging on slow sites
    await page.goto(googleNewsUrl, { waitUntil: "networkidle2", timeout: 15000 });
    const resolvedUrl = page.url();
    
    await browser.close();
    return resolvedUrl;
  } catch (error) {
    console.error("Failed to resolve Google News URL via Puppeteer:", error.message);
    return googleNewsUrl;
  }
}

// Helper: Fetch YouTube Comments
async function fetchYouTubeComments(videoId, maxResults = 20) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      console.warn("GOOGLE_API_KEY is missing. Skipping YouTube comments.");
      return [];
    }
    const response = await youtube.commentThreads.list({
      part: ["snippet"],
      videoId: videoId,
      maxResults: maxResults,
      order: "relevance",
    });

    if (!response.data.items) return [];

    return response.data.items.map(item => {
      const comment = item.snippet.topLevelComment.snippet;
      return `User: ${comment.textDisplay}`;
    });
  } catch (error) {
    console.error(`Error fetching YT comments for video ${videoId}:`, error.message);
    return []; // Return empty array if comments are disabled or error occurs
  }
}

const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    item: ['content', 'contentSnippet', 'guid', 'isoDate'],
  }
});

// ── Search ─────────────────────────────────────────────────────────
async function performSearch(keyword, socialOnly = true) {
  // Use Google News RSS for reliable, unblocked searching
  const query = socialOnly
    ? `site:facebook.com OR site:x.com OR site:tiktok.com OR site:instagram.com OR site:youtube.com ${keyword}`
    : keyword;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
  
  const feed = await parser.parseURL(url);

  // Return up to 50 results
  let items = feed.items.slice(0, 50).map((r) => {
    // Extract publisher from content or title
    let publisher = "Web";
    const pubMatch = r.content?.match(/<font color="#6f6f6f">([^<]+)<\/font>/);
    if (pubMatch && pubMatch[1]) {
      publisher = pubMatch[1];
    } else if (r.title.includes(" - ")) {
      publisher = r.title.split(" - ").pop();
    }

    // Guess domain for favicon
    let domain = "google.com";
    const pubLower = publisher.toLowerCase();
    const titleLower = r.title.toLowerCase();
    if (pubLower.includes("facebook") || titleLower.includes("facebook")) domain = "facebook.com";
    else if (pubLower.includes("tiktok") || titleLower.includes("tiktok")) domain = "tiktok.com";
    else if (pubLower.includes("twitter") || pubLower.includes("x.com") || titleLower.includes("x.com")) domain = "x.com";
    else if (pubLower.includes("youtube") || titleLower.includes("youtube")) domain = "youtube.com";
    else if (pubLower.includes("instagram") || titleLower.includes("instagram")) domain = "instagram.com";

    // Extract page name (author/channel) if it's social media
    let pageName = publisher;
    if (["facebook.com", "x.com", "tiktok.com", "youtube.com", "instagram.com"].includes(domain)) {
      if (domain === "x.com") {
        const m = r.title.match(/^(.*?) on X:/);
        if (m) pageName = m[1];
        else pageName = "X (Twitter)";
      } else if (domain === "youtube.com") {
        const parts = r.title.replace(/ - YouTube$/i, "").split(/ \| /);
        if (parts.length > 1) {
           pageName = (parts.length === 3 ? parts[1] : parts[parts.length - 1]).trim();
        } else {
           pageName = "YouTube";
        }
      } else {
        const parts = r.title.split(/ \. | - | \: | \| /);
        // Page name is usually the very first part of the title on Facebook/IG posts
        if (parts.length > 1 && parts[0].length < 60) {
           pageName = parts[0].trim();
        } else {
           pageName = domain === "facebook.com" ? "Facebook" : 
                      domain === "instagram.com" ? "Instagram" :
                      domain === "tiktok.com" ? "TikTok" : publisher;
        }
      }
    }

    // Clean up snippet
    let snippet = r.contentSnippet || r.content || r.title;
    // Remove the publisher part from snippet if it exists at the end
    snippet = snippet.replace(new RegExp(`\\s*${publisher}$`), "").trim();

    return {
      title: r.title,
      snippet: snippet,
      link: r.link,
      publisher: publisher,
      pageName: pageName,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      pubDate: r.isoDate || r.pubDate || new Date().toISOString(),
      timestamp: new Date(r.isoDate || r.pubDate || new Date()).getTime(),
    };
  });
  
  // Sort from newest to oldest
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}

// ── Gemini Analysis ──────────────────────────────────────────────────
async function analyzeWithGemini(snippets) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Using gemini-2.5-flash-lite based on API key permissions
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const combinedText = snippets.join("\n\n---\n\n");

  const prompt = `
  You are an expert Social Listening Analyst. Analyze the following news/social media snippets and return the result strictly as a valid JSON object.
  Do NOT use markdown code blocks like \`\`\`json. Just output the raw JSON directly.

  Focus on key themes, public sentiment, and overall narrative.
  
  Snippets:
  ${combinedText}

  Return your analysis exactly in this JSON format:
  {
    "summary": "A 2-4 sentence executive summary of the overall discussion and key themes.",
    "positiveFeedback": "A paragraph summarizing the overall positive feedback and sentiments.",
    "negativeFeedback": "A paragraph summarizing the overall negative feedback, concerns, and issues.",
    "sentiment": {
      "positive": 20,
      "neutral": 50,
      "negative": 30
    }
  }

  IMPORTANT: 
  - The positive, neutral, and negative values must sum to 100.
  - Return the response ONLY as raw JSON text. No markdown formatting.
  - If there is no specific positive or negative feedback, return an empty string "".
  - Use Thai language for summary and feedback points.
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip possible markdown formatting that the AI might accidentally include
  const cleanJsonText = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleanJsonText);
    return parsed;
  } catch (error) {
    console.error("Failed to parse Gemini JSON output:", cleanJsonText);
    throw new Error("Failed to parse the AI analysis result.");
  }
}

// ── API Routes ───────────────────────────────────────────────────────

// 1. Search Step
app.post("/api/search", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "Keyword is required." });
    }

    console.log(`🔍  Searching for: "${keyword}"`);

    // 1. Social-media-first search
    let items = await performSearch(keyword, true);
    let searchType = "social";

    // 2. Fallback to general search
    if (items.length === 0) {
      console.log("   ↳ No social results, falling back to general search…");
      items = await performSearch(keyword, false);
      searchType = "general";
    }

    if (items.length === 0) {
      return res.json({
        keyword,
        searchType,
        results: [],
      });
    }

    // Return the raw snippets first
    return res.json({
      keyword,
      searchType,
      results: items,
    });
  } catch (err) {
    console.error("❌ Search Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Analyze Step
app.post("/api/analyze", async (req, res) => {
  try {
    const { keyword, searchType, results } = req.body;
    
    if (!results || results.length === 0) {
      return res.status(400).json({ error: "No results provided for analysis" });
    }

    // Enrich YouTube results with fetched comments
    const enrichedResults = await Promise.all(
      results.map(async (item) => {
        let snippet = item.snippet;
        let commentsArray = [];
        
        // Resolve the true URL first if it's a proxy link
        const realUrl = await resolveGoogleNewsUrl(item.link);
        const videoId = extractYouTubeVideoId(realUrl);
        
        if (videoId) {
          const fetchedComments = await fetchYouTubeComments(videoId, 100); // Fetch up to 100 comments
          if (fetchedComments && fetchedComments.length > 0) {
            commentsArray = fetchedComments;
            // Append top comments to the snippet for Gemini to read
            snippet += `\n\n[Real User Comments on YouTube]:\n- ` + commentsArray.join("\n- ");
          }
        }
        
        return {
          title: item.title,
          snippet: snippet,
          link: realUrl, // Return the direct link instead of the proxy
          comments: commentsArray // Attach comments for the UI to display
        };
      })
    );

    const mapText = enrichedResults.map((s, i) => `[${i + 1}] Title: ${s.title}\nContent/Comments: ${s.snippet}\nURL: ${s.link}`);
    
    console.log(`Analyzing ${mapText.length} items with Gemini...`);

    const analysis = await analyzeWithGemini(mapText);
    
    // Send analysis along with the enriched results so UI can show the comments
    res.json({
      ...analysis,
      enrichedResults
    });
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze data" });
  }
});

// ── Health check ─────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Social Listening API running on http://localhost:${PORT}\n`);
});
