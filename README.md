# Gsocial - Social Listening Dashboard

A modern, real-time Social Listening Dashboard built with Vue 3 and Node.js. It searches across multiple social platforms and news sources, and uses Google Gemini AI to analyze the sentiment and summarize the discussions.

## 🚀 Features

*   **Multi-Platform Search:** Scrapes and aggregats results from Facebook, X (Twitter), TikTok, Instagram, YouTube, and Google News.
*   **AI Sentiment Analysis:** Select specific news articles or posts and send them to Google Gemini AI to analyze sentiment (Positive, Neutral, Negative) and extract key summary points.
*   **Modern UI/UX:** Built with Vue 3, Tailwind CSS v3, and an attractive dark-mode glassmorphism design.
*   **Intuitive Controls:** Includes pagination (load more), result selection checkboxes, and source visualizers (publisher favicons & publishing timestamps).

## 🛠️ Tech Stack

### Frontend (Client)
*   [Vue 3](https://vuejs.org/) (Composition API)
*   [Vite](https://vitejs.dev/)
*   [Tailwind CSS v3](https://tailwindcss.com/)
*   [Chart.js](https://www.chartjs.org/) & [vue-chartjs](https://vue-chartjs.org/)
*   [Lucide Icons](https://lucide.dev/)
*   [Axios](https://axios-http.com/)

### Backend (Server)
*   [Node.js](https://nodejs.org/)
*   [Express](https://expressjs.com/)
*   [rss-parser](https://www.npmjs.com/package/rss-parser) (For reliable Google News feed searching)
*   [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) (Gemini API integration)

## ⚙️ Prerequisites

1.  **Node.js** (v18 or higher recommended)
2.  **Google Gemini API Key:** You must have an API key to use the sentiment analysis feature ([Get it here](https://aistudio.google.com/)).

## 📦 Installation & Setup

### 1. Backend Setup

Open a terminal and navigate to the `server` folder:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory and add your Gemini API Key:

```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend server:

```bash
node server.js
```
The server will run on `http://localhost:3001`.

### 2. Frontend Setup

Open a new terminal window and navigate to the `client` folder:

```bash
cd client
npm install
```

Start the frontend development server:

```bash
npm run dev
```
The frontend will typically run on `http://localhost:5173` or `5174`. Open this URL in your browser to view the dashboard!

## 📝 Usage Guide

1.  **Search:** Enter a keyword (e.g., "iPhone 16" or "ชายแดน") in the search bar and press Enter.
2.  **Select Results:** By default, all cards are unchecked. Click the checkboxes on the specific results you want the AI to read. (You can also click "Select links to include in AI analysis" to toggle all at once).
3.  **Analyze:** Click the "Analyze X Links" button. The server will send the text to Gemini AI.
4.  **View Report:** Review the Sentiment Donut Chart, Executive Summary, Key Discussion points, and Suggested Actions.

## 📄 License

This project is licensed under the MIT License.
