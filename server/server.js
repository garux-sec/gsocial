require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");
const puppeteer = require("puppeteer");
const { ApifyClient } = require("apify-client");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize YouTube API client
const youtube = google.youtube({
  version: "v3",
  auth: process.env.GOOGLE_API_KEY,
});

// Initialize Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Helper: Extract YouTube Video ID from URL
function extractYouTubeVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Helper: Check if URL is a Facebook URL
function isFacebookUrl(url) {
  return url.includes("facebook.com") || url.includes("fb.com") || url.includes("fb.watch");
}

// Helper: Check if URL is a TikTok URL
function isTikTokUrl(url) {
  return url.includes("tiktok.com");
}

// Helper: Check if URL is an Instagram URL
function isInstagramUrl(url) {
  return url.includes("instagram.com") || url.includes("instagr.am");
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
    return [];
  }
}

// Helper: Fetch Facebook Comments via Apify
async function fetchFacebookComments(postUrl, maxResults = 100) {
  try {
    if (!process.env.APIFY_API_TOKEN) {
      console.warn("APIFY_API_TOKEN is missing. Skipping Facebook comments.");
      return [];
    }

    console.log(`📘 Fetching Facebook comments for: ${postUrl}`);

    // Run the Facebook Comments Scraper actor
    const run = await apifyClient.actor("apify/facebook-comments-scraper").call({
      startUrls: [{ url: postUrl }],
      resultsLimit: maxResults,
    }, {
      timeout: 120, // 2 minute timeout
    });

    // Fetch results from the run's dataset
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) return [];

    return items.map(item => {
      const author = item.profileName || item.name || "User";
      const text = item.text || item.message || "";
      return `${author}: ${text}`;
    }).filter(c => c.length > 10);
  } catch (error) {
    console.error(`Error fetching FB comments for ${postUrl}:`, error.message);
    return [];
  }
}

// Helper: Fetch TikTok Comments via Apify
async function fetchTikTokComments(postUrl, maxResults = 100) {
  try {
    if (!process.env.APIFY_API_TOKEN) {
      console.warn("APIFY_API_TOKEN is missing. Skipping TikTok comments.");
      return [];
    }

    console.log(`🎵 Fetching TikTok comments for: ${postUrl}`);

    const run = await apifyClient.actor("clockworks/tiktok-comments-scraper").call({
      postURLs: [postUrl],
      commentsPerPost: maxResults,
    }, {
      timeout: 120,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return [];

    return items.map(item => {
      const author = item.uniqueId || item.nickname || "User";
      const text = item.text || item.comment || "";
      return `${author}: ${text}`;
    }).filter(c => c.length > 10);
  } catch (error) {
    console.error(`Error fetching TikTok comments for ${postUrl}:`, error.message);
    return [];
  }
}

// Helper: Fetch Instagram Comments via Apify
async function fetchInstagramComments(postUrl, maxResults = 100) {
  try {
    if (!process.env.APIFY_API_TOKEN) {
      console.warn("APIFY_API_TOKEN is missing. Skipping Instagram comments.");
      return [];
    }

    console.log(`📷 Fetching Instagram comments for: ${postUrl}`);

    const run = await apifyClient.actor("apify/instagram-comment-scraper").call({
      directUrls: [postUrl],
      resultsLimit: maxResults,
    }, {
      timeout: 120,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return [];

    return items.map(item => {
      const author = item.ownerUsername || item.username || "User";
      const text = item.text || "";
      return `${author}: ${text}`;
    }).filter(c => c.length > 10);
  } catch (error) {
    console.error(`Error fetching IG comments for ${postUrl}:`, error.message);
    return [];
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
    "positiveFeedbackIsAI": false,
    "negativeFeedback": "A paragraph summarizing the overall negative feedback, concerns, and issues.",
    "negativeFeedbackIsAI": false,
    "sentiment": {
      "positive": 20,
      "neutral": 50,
      "negative": 30
    }
  }

  IMPORTANT: 
  - The positive, neutral, and negative values must sum to 100.
  - Return the response ONLY as raw JSON text. No markdown formatting.
  - You MUST always provide BOTH positiveFeedback and negativeFeedback paragraphs. Never leave them empty.
  - If the data clearly contains positive or negative sentiments, summarize them and set the corresponding "IsAI" field to false.
  - If the data does NOT contain clear positive or negative sentiments, you MUST still write a reasonable analysis or perspective for that category based on your understanding. Set the corresponding "IsAI" field to true to indicate this was generated by AI rather than extracted from the data.
  - Use Thai language for summary and feedback.
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

    // Enrich results with fetched comments (YouTube + Facebook)
    const enrichedResults = await Promise.all(
      results.map(async (item) => {
        let snippet = item.snippet;
        let commentsArray = [];
        let commentSource = null;
        
        // Resolve the true URL first if it's a proxy link
        const realUrl = await resolveGoogleNewsUrl(item.link);
        
        // Try YouTube first
        const videoId = extractYouTubeVideoId(realUrl);
        if (videoId) {
          commentSource = "YouTube";
          const fetchedComments = await fetchYouTubeComments(videoId, 100);
          if (fetchedComments && fetchedComments.length > 0) {
            commentsArray = fetchedComments;
            snippet += `\n\n[Real User Comments on YouTube]:\n- ` + commentsArray.join("\n- ");
          }
        }
        // Try Facebook
        else if (isFacebookUrl(realUrl)) {
          commentSource = "Facebook";
          const fetchedComments = await fetchFacebookComments(realUrl, 100);
          if (fetchedComments && fetchedComments.length > 0) {
            commentsArray = fetchedComments;
            snippet += `\n\n[Real User Comments on Facebook]:\n- ` + commentsArray.join("\n- ");
          }
        }
        // Try TikTok
        else if (isTikTokUrl(realUrl)) {
          commentSource = "TikTok";
          const fetchedComments = await fetchTikTokComments(realUrl, 100);
          if (fetchedComments && fetchedComments.length > 0) {
            commentsArray = fetchedComments;
            snippet += `\n\n[Real User Comments on TikTok]:\n- ` + commentsArray.join("\n- ");
          }
        }
        // Try Instagram
        else if (isInstagramUrl(realUrl)) {
          commentSource = "Instagram";
          const fetchedComments = await fetchInstagramComments(realUrl, 100);
          if (fetchedComments && fetchedComments.length > 0) {
            commentsArray = fetchedComments;
            snippet += `\n\n[Real User Comments on Instagram]:\n- ` + commentsArray.join("\n- ");
          }
        }
        
        return {
          title: item.title,
          snippet: snippet,
          link: realUrl,
          comments: commentsArray,
          commentSource: commentSource
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

// ── Facebook Page Posts ──────────────────────────────────────────────
const FB_PAGES = [
  { name: "THE STANDARD", url: "https://www.facebook.com/thestandardth", icon: "📰" },
  { name: "Thai PBS", url: "https://www.facebook.com/ThaiPBS", icon: "📺" },
  { name: "TNN", url: "https://www.facebook.com/TNNthailand", icon: "📡" },
  { name: "กระทรวงการคลัง", url: "https://www.facebook.com/MoFNewsStationThailand", icon: "🏦" },
  { name: "กระทรวงกลาโหม", url: "https://www.facebook.com/modprth", icon: "🛡️" },
];

// GET: Return the list of configured pages
app.get("/api/fb-pages", (_req, res) => {
  res.json({ pages: FB_PAGES });
});

// POST: Fetch posts from selected Facebook pages
app.post("/api/fb-pages/fetch", async (req, res) => {
  try {
    const { pageUrls, maxPosts = 5 } = req.body;

    if (!pageUrls || pageUrls.length === 0) {
      return res.status(400).json({ error: "No page URLs specified" });
    }

    if (!process.env.APIFY_API_TOKEN) {
      return res.status(500).json({ error: "APIFY_API_TOKEN not configured" });
    }

    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]; // e.g. "2026-03-14"

    console.log(`📘 Fetching Facebook posts from ${pageUrls.length} pages since ${todayStr}...`);

    const startUrls = pageUrls.map(url => ({ url }));

    const run = await apifyClient.actor("apify/facebook-posts-scraper").call({
      startUrls,
      resultsLimit: maxPosts,
      minPostDate: todayStr,
    }, {
      timeout: 180, // 3 minute timeout
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return res.json({ posts: [], message: "No posts found for today" });
    }

    const posts = items.map(item => ({
      pageName: item.pageName || item.user?.name || "Unknown",
      text: item.text || item.message || "",
      url: item.url || item.postUrl || "",
      date: item.time || item.timestamp || "",
      likes: item.likes || item.reactionsCount || 0,
      comments: item.comments || item.commentsCount || 0,
      shares: item.shares || item.sharesCount || 0,
      media: item.media?.[0]?.thumbnail || item.imageUrl || null,
    }));

    console.log(`✅ Fetched ${posts.length} posts from Facebook pages`);
    res.json({ posts });
  } catch (error) {
    console.error("FB Pages Error:", error.message);
    res.status(500).json({ error: "Failed to fetch Facebook page posts: " + error.message });
  }
});

// POST: Filter FB posts by topic using AI, then analyze with comments
app.post("/api/fb-pages/filter-analyze", async (req, res) => {
  try {
    const { posts, topic } = req.body;

    if (!posts || posts.length === 0) {
      return res.status(400).json({ error: "No posts provided" });
    }
    if (!topic) {
      return res.status(400).json({ error: "No topic specified" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Step 1: Use Gemini to filter relevant posts
    const postsList = posts.map((p, i) => `[${i}] ${p.pageName}: ${p.text?.substring(0, 300)}`).join("\n\n");

    const filterPrompt = `
    You are a smart news filter. Given the topic "${topic}", review the following Facebook posts and return ONLY the indices (numbers) of posts that are RELEVANT to this topic.
    
    Posts:
    ${postsList}
    
    Return your answer as a JSON array of indices, e.g. [0, 2, 5]
    If no posts are relevant, return an empty array []
    Return ONLY the JSON array, nothing else.
    `;

    const filterResult = await model.generateContent(filterPrompt);
    let filterText = filterResult.response.text().trim();
    filterText = filterText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let relevantIndices;
    try {
      relevantIndices = JSON.parse(filterText);
    } catch {
      console.error("Failed to parse filter result:", filterText);
      relevantIndices = [];
    }

    const filteredPosts = relevantIndices
      .filter(i => i >= 0 && i < posts.length)
      .map(i => posts[i]);

    console.log(`🔍 Topic "${topic}": ${filteredPosts.length}/${posts.length} posts are relevant`);

    if (filteredPosts.length === 0) {
      return res.json({
        filteredPosts: [],
        analysis: null,
        message: `ไม่พบโพสต์ที่เกี่ยวข้องกับ "${topic}"`,
      });
    }

    // Step 2: Fetch comments for each filtered post
    console.log(`💬 Fetching comments for ${filteredPosts.length} filtered posts...`);
    const postsWithComments = await Promise.all(
      filteredPosts.map(async (post) => {
        let comments = [];
        if (post.url && isFacebookUrl(post.url)) {
          try {
            const rawComments = await fetchFacebookComments(post.url, 50);
            // Filter out short/meaningless comments (< 20 chars)
            comments = rawComments.filter(c => {
              const textPart = c.includes(":") ? c.split(":").slice(1).join(":").trim() : c;
              return textPart.length >= 20;
            });
          } catch (e) {
            console.warn(`Could not fetch comments for ${post.url}:`, e.message);
          }
        }
        return { ...post, fetchedComments: comments };
      })
    );

    console.log(`✅ Done. Returning ${postsWithComments.length} posts with comments.`);

    res.json({
      filteredPosts: postsWithComments,
    });
  } catch (error) {
    console.error("FB Filter-Analyze Error:", error.message);
    res.status(500).json({ error: "Failed to filter and analyze: " + error.message });
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
