# 1-Group Review Intelligence

AI-powered review analysis and competitor benchmarking for 1-Group Singapore venues.

## How It Works

1. **Select a venue** from the 9 1-Group venues
2. **Paste a Google Maps URL** — the tool calls Outscraper's API to extract real reviews
3. **AI scores every review** on Food / Service / Atmosphere (1-5)
4. **Discover competitors** — AI finds 5 direct + 5 indirect competitors
5. **Generate strategy** — AI-powered recommendations, quick wins, and competitive threats

## Tech Stack

- **Next.js 14** — React framework with API routes
- **Outscraper API** — Extracts real Google Reviews (no scraping blocks)
- **Claude AI (Anthropic)** — Scores reviews, discovers competitors, generates strategy
- **Vercel** — Hosting with serverless functions

## Deploy to Vercel

### Step 1: Push to GitHub

```bash
cd 1group-review-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/1group-review-intelligence.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"**
3. Import your `1group-review-intelligence` repository
4. In **Environment Variables**, add:
   - `OUTSCRAPER_API_KEY` = your Outscraper API key
   - `ANTHROPIC_API_KEY` = your Anthropic API key
5. Click **Deploy**

### Step 3: Get API Keys

- **Outscraper**: [outscraper.com](https://outscraper.com) → Profile → API Key
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key

## Local Development

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Routes

- `POST /api/reviews` — Fetch + score reviews via Outscraper + Claude
- `POST /api/competitors` — Discover competitors via Claude + web search
- `POST /api/score` — Generate strategic recommendations

## Cost Estimates

- **Outscraper**: ~$0.002 per review extracted. 30 reviews = ~$0.06 per venue.
- **Anthropic**: ~$0.01-0.05 per API call depending on review count.
- **Monthly cost for 9 venues**: ~$5-10 estimated.
