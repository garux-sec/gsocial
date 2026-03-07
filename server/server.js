require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const Parser = require("rss-parser");
const parser = new Parser();

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

  const combinedText = snippets
    .map((s, i) => `[${i + 1}] Title: ${s.title}\nSnippet: ${s.snippet}\nURL: ${s.link}`)
    .join("\n\n");

  const prompt = `
  You are an expert Social Listening Analyst. Analyze the following news/social media snippets and return the result strictly as a valid JSON object.
  Do NOT use markdown code blocks like \`\`\`json. Just output the raw JSON directly.

  Focus on key themes, public sentiment, and overall narrative.
  
  Snippets:
  ${combinedText}

  Return your analysis exactly in this JSON format:
  {
    "summary": "A 2-4 sentence executive summary of the overall discussion and key themes.",
    "positiveFeedback": ["Point 1", "Point 2", "Point 3"],
    "negativeFeedback": ["Issue 1", "Issue 2", "Issue 3"],
    "sentiment": {
      "positive": 20,
      "neutral": 50,
      "negative": 30
    }
  }

  IMPORTANT: 
  - The positive, neutral, and negative values must sum to 100.
  - Return the response ONLY as raw JSON text. No markdown formatting.
  - If a feedback category has no points, return an empty array [].
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
      return res.status(400).json({ error: "No search results provided to analyze." });
    }

    console.log(`🧠  Analyzing ${results.length} results for: "${keyword}"…`);
    
    // Analyze with Gemini
    const analysis = await analyzeWithGemini(results);

    return res.json({
      keyword,
      searchType,
      ...analysis,
    });
  } catch (err) {
    console.error("❌ Analysis Error:", err.message);
    return res.status(500).json({ error: err.message });
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
