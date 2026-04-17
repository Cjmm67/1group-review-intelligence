// lib/wedding-scraper.js
// Scrapes wedding-related reviews from Lemon8 and Bridely using
// Claude API + web_search. These platforms don't have REST APIs,
// so we use AI-powered web search to find, extract, and structure
// wedding review content for 1-Group venues.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function sentimentFromRating(r) {
  if (r >= 4) return 'positive';
  if (r >= 3) return 'neutral';
  return 'negative';
}

async function callClaudeWithSearch({ system, user, maxTokens = 4096 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Claude API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    if (start === -1) return { reviews: [] };
    let partial = cleaned.slice(start).replace(/,\s*"[^"]*$/s, '').replace(/,\s*$/s, '');
    const ob = (partial.match(/{/g) || []).length - (partial.match(/}/g) || []).length;
    const obk = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length;
    for (let i = 0; i < obk; i++) partial += ']';
    for (let i = 0; i < ob; i++) partial += '}';
    try { return JSON.parse(partial); } catch { return { reviews: [] }; }
  }
}

// ─────────────────────────────────────────────────────────────
// Lemon8 Scraper
// Lemon8 is a lifestyle social platform (ByteDance) popular in
// Singapore for wedding inspiration and venue reviews. Content
// appears as posts, not traditional reviews. We search for
// wedding-specific posts mentioning the venue.
// ─────────────────────────────────────────────────────────────
export async function scrapeLemon8Reviews({ venueName, parentVenueName }) {
  const searchName = parentVenueName
    ? `${venueName} OR ${parentVenueName}`
    : venueName;

  try {
    const result = await callClaudeWithSearch({
      system: `You are a wedding review researcher for 1-Group Singapore.
Search Lemon8 (lemon8-app.com) for posts about weddings at the specified venue.
Also search for the venue name combined with "wedding" and "lemon8".

CRITICAL RULES:
1. NEVER copy post text verbatim. Always PARAPHRASE.
2. Extract: author name, approximate date, rating (1-5, infer from sentiment if not explicit), and wedding-specific themes.
3. Focus on: ceremony experience, reception quality, coordination, food, decor, staff, photos.
4. If you cannot find posts on Lemon8 specifically, return an empty reviews array.
5. Return ONLY valid JSON. No markdown fences.`,

      user: `Search Lemon8 for wedding reviews and posts about "${searchName}" Singapore.

Search queries to try:
- "${venueName} wedding lemon8"
- "${parentVenueName || venueName} wedding venue Singapore lemon8"
- "lemon8 ${venueName} wedding review"
- site:lemon8-app.com "${venueName}" wedding

Return JSON:
{
  "platform": "lemon8",
  "venue": "${venueName}",
  "total_found": number,
  "reviews": [
    {
      "author": "username",
      "date": "YYYY-MM-DD approximate",
      "rating": 1-5 (inferred from tone),
      "title": "Post title if any",
      "summary": "Paraphrased 1-2 sentence summary",
      "wedding_type": "banquet|solemnisation|both|ROM|tea ceremony",
      "themes": ["theme1", "theme2"],
      "team_members": ["Name1"]
    }
  ]
}`,
    });

    const reviews = (result.reviews || []).map((r, i) => ({
      id: `l8-${String(i + 1).padStart(3, '0')}`,
      source: 'lemon8',
      sourceLabel: 'Lemon8',
      date: r.date || '',
      rating: r.rating || null,
      author: r.author || '',
      title: r.title || '',
      text: r.summary || '',
      summary: r.summary || '',
      weddingType: r.wedding_type || null,
      sentiment: sentimentFromRating(r.rating || 3),
      key_themes: r.themes || [],
      team_members: r.team_members || [],
      reviewUrl: '',
    }));

    return {
      venue: venueName,
      reviews,
      source: 'lemon8',
      totalFound: result.total_found || reviews.length,
    };
  } catch (err) {
    return {
      venue: venueName,
      reviews: [],
      source: 'lemon8',
      totalFound: 0,
      error: err?.message || String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Bridely Scraper
// Bridely (bridely.me / bridely.com.sg) is a Singapore wedding
// planning platform with real venue reviews, ratings, and
// couple testimonials. Much more structured than Lemon8.
// ─────────────────────────────────────────────────────────────
export async function scrapeBridelyReviews({ venueName, parentVenueName }) {
  const searchName = parentVenueName
    ? `${venueName} OR ${parentVenueName}`
    : venueName;

  try {
    const result = await callClaudeWithSearch({
      system: `You are a wedding review researcher for 1-Group Singapore.
Search Bridely (bridely.me, bridely.com.sg, thebridely.com) for wedding venue reviews
and couple testimonials about the specified venue.

CRITICAL RULES:
1. NEVER copy review text verbatim. Always PARAPHRASE.
2. Extract: couple names, wedding date, rating (1-5 if shown), and wedding-specific details.
3. Focus on: venue coordination, banquet quality, wedding planning support, decor, food, service, value for money.
4. Also search for the venue on other Singapore wedding platforms: SingaporeBrides, WeddingVow, Blissful Brides.
5. If you cannot find reviews on Bridely specifically, check these other platforms and label the source correctly.
6. Return ONLY valid JSON. No markdown fences.`,

      user: `Search Bridely and Singapore wedding platforms for wedding venue reviews about "${searchName}" Singapore.

Search queries to try:
- "${venueName} wedding review bridely"
- "${parentVenueName || venueName} wedding venue review Singapore"
- "bridely ${venueName} review"
- "${venueName} wedding venue review singaporebrides"
- "${venueName} wedding review weddingvow"
- "${venueName} wedding banquet review Singapore"

Return JSON:
{
  "platform": "bridely",
  "venue": "${venueName}",
  "total_found": number,
  "reviews": [
    {
      "author": "Couple name or username",
      "date": "YYYY-MM-DD approximate",
      "rating": 1-5 (if shown, or inferred),
      "platform_source": "bridely|singaporebrides|weddingvow|blissfulbrides|other",
      "title": "Review title if any",
      "summary": "Paraphrased 1-2 sentence summary focusing on wedding experience",
      "wedding_type": "banquet|solemnisation|both|ROM|tea ceremony",
      "guest_count": number or null,
      "themes": ["coordination", "food quality", "decor"],
      "team_members": ["Name1"]
    }
  ]
}`,
    });

    const reviews = (result.reviews || []).map((r, i) => ({
      id: `br-${String(i + 1).padStart(3, '0')}`,
      source: 'bridely',
      sourceLabel: r.platform_source ? capitalize(r.platform_source) : 'Bridely',
      date: r.date || '',
      rating: r.rating || null,
      author: r.author || '',
      title: r.title || '',
      text: r.summary || '',
      summary: r.summary || '',
      weddingType: r.wedding_type || null,
      guestCount: r.guest_count || null,
      sentiment: sentimentFromRating(r.rating || 3),
      key_themes: r.themes || [],
      team_members: r.team_members || [],
      reviewUrl: '',
    }));

    return {
      venue: venueName,
      reviews,
      source: 'bridely',
      totalFound: result.total_found || reviews.length,
    };
  } catch (err) {
    return {
      venue: venueName,
      reviews: [],
      source: 'bridely',
      totalFound: 0,
      error: err?.message || String(err),
    };
  }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─────────────────────────────────────────────────────────────
// Combined wedding platform scraper
// Runs Lemon8 + Bridely in parallel. Graceful degradation.
// ─────────────────────────────────────────────────────────────
export async function scrapeWeddingPlatforms({ venueName, parentVenueName }) {
  const [lemon8, bridely] = await Promise.all([
    scrapeLemon8Reviews({ venueName, parentVenueName })
      .catch(e => ({ venue: venueName, reviews: [], source: 'lemon8', error: e?.message })),
    scrapeBridelyReviews({ venueName, parentVenueName })
      .catch(e => ({ venue: venueName, reviews: [], source: 'bridely', error: e?.message })),
  ]);

  return {
    lemon8,
    bridely,
    allReviews: [...(lemon8.reviews || []), ...(bridely.reviews || [])],
    sources: {
      lemon8: (lemon8.reviews || []).length,
      bridely: (bridely.reviews || []).length,
    },
    errors: {
      lemon8: lemon8.error || null,
      bridely: bridely.error || null,
    },
  };
}
