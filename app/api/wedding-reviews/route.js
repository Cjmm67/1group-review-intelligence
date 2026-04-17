// app/api/wedding-reviews/route.js
// Fetches wedding-specific reviews from 4 sources:
//   1. Google Maps (via Outscraper) — searches for wedding-related reviews
//   2. TripAdvisor (via Outscraper) — same
//   3. Lemon8 (via Claude + web_search)
//   4. Bridely + SG wedding platforms (via Claude + web_search)
// Then scores everything with a wedding-specific Claude prompt.

import { fetchAllReviews } from '@/lib/outscraper';
import { scrapeWeddingPlatforms } from '@/lib/wedding-scraper';
import { scoreWeddingReviews } from '@/lib/claude';

export const maxDuration = 120; // Wedding scraping hits 4 sources — needs runway

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query,           // Google Maps URL or venue name
      venueName,       // e.g. "The Alkaff Mansion"
      parentVenueName, // e.g. "The Alkaff Mansion" (for sub-brand context)
      venueType,
      googleLimit = 40,
      tripAdvisorLimit = 20,
      dateFrom,
      dateTo,
    } = body;

    if (!query && !venueName) {
      return Response.json({ error: 'Missing query or venue name' }, { status: 400 });
    }

    const cutoff = dateFrom ? String(Math.floor(new Date(dateFrom).getTime() / 1000)) : null;

    // ── Step 1: All 4 sources in parallel ──
    // Google/TripAdvisor via Outscraper (the query includes "wedding" to bias results)
    const weddingQuery = query || `${venueName} Singapore wedding`;
    const outscraperTask = fetchAllReviews({
      query: weddingQuery,
      googleLimit,
      tripAdvisorLimit,
      cutoff,
      includeTripAdvisor: true,
    }).catch(e => ({
      venue: venueName, reviews: [], sources: { google: 0, tripadvisor: 0 },
      errors: { google: e?.message, tripadvisor: null },
    }));

    // Lemon8 + Bridely via Claude + web_search
    const weddingPlatformsTask = scrapeWeddingPlatforms({
      venueName: venueName || query,
      parentVenueName,
    }).catch(e => ({
      allReviews: [], sources: { lemon8: 0, bridely: 0 },
      errors: { lemon8: e?.message, bridely: e?.message },
    }));

    const [outscraper, weddingPlatforms] = await Promise.all([outscraperTask, weddingPlatformsTask]);

    // ── Step 2: Filter Google/TA reviews for wedding relevance ──
    // Keep all reviews but tag wedding-relevant ones. The scorer
    // will weight wedding-specific content higher.
    const weddingKeywords = /wedding|wed|bride|groom|banquet|solemnisation|ROM|reception|matrimon|nuptial|bridal|vow|ceremony|bouquet|corsage|march.?in/i;
    const outscraperReviews = (outscraper.reviews || []).map(r => ({
      ...r,
      isWeddingRelevant: weddingKeywords.test(r.text || '') || weddingKeywords.test(r.title || ''),
    }));

    // Prioritise wedding-relevant reviews, then pad with general reviews
    const weddingRelevant = outscraperReviews.filter(r => r.isWeddingRelevant);
    const generalReviews = outscraperReviews.filter(r => !r.isWeddingRelevant);
    const sortedOutscraper = [...weddingRelevant, ...generalReviews];

    // Merge all sources
    const allReviews = [...sortedOutscraper, ...(weddingPlatforms.allReviews || [])];

    // Filter by dateTo if specified
    let reviews = allReviews;
    if (dateTo) {
      const toDate = new Date(dateTo);
      reviews = reviews.filter(r => {
        if (!r.date) return true;
        return new Date(r.date) <= toDate;
      });
    }

    if (reviews.length === 0) {
      return Response.json({
        venue: outscraper.venue || venueName,
        reviews: [],
        reviewCount: 0,
        sources: {
          google: outscraper.sources?.google ?? 0,
          tripadvisor: outscraper.sources?.tripadvisor ?? 0,
          lemon8: weddingPlatforms.sources?.lemon8 ?? 0,
          bridely: weddingPlatforms.sources?.bridely ?? 0,
        },
        sourceErrors: {
          ...outscraper.errors,
          ...weddingPlatforms.errors,
        },
        weddingRelevantCount: 0,
        message: 'No wedding reviews found across any platform.',
      });
    }

    // ── Step 3: Score with wedding-specific Claude prompt ──
    const scored = await scoreWeddingReviews({
      venueName: venueName || outscraper.venue,
      venueType: venueType || 'Wedding Venue',
      reviews,
    });

    // ── Step 4: Merge raw reviews with AI scores ──
    const toNum = v => (typeof v === 'number' && !isNaN(v)) ? v : 0;
    const mergedReviews = reviews.map((raw, i) => {
      const ai = scored.reviews?.[i] || {};
      const fallback = raw.rating >= 4 ? 4 : raw.rating >= 3 ? 3 : 2;
      return {
        ...raw,
        food_score: toNum(ai.food_score) || fallback,
        service_score: toNum(ai.service_score) || fallback,
        atmosphere_score: toNum(ai.atmosphere_score) || fallback,
        coordination_score: toNum(ai.coordination_score) || fallback,
        sentiment: ai.sentiment || raw.sentiment,
        summary: ai.summary || (raw.text || '').slice(0, 120),
        key_themes: ai.key_themes || raw.key_themes || [],
        team_members: ai.team_members || raw.team_members || [],
      };
    });

    return Response.json({
      venue: outscraper.venue || venueName,
      googleRating: outscraper.googleRating ?? null,
      tripAdvisorRating: outscraper.tripAdvisorRating ?? null,
      scrapeDate: new Date().toISOString().split('T')[0],
      period: `${dateFrom || 'all'} to ${dateTo || 'now'}`,
      reviewCount: mergedReviews.length,
      weddingRelevantCount: weddingRelevant.length + (weddingPlatforms.allReviews || []).length,
      sources: {
        google: (outscraper.sources?.google ?? 0),
        tripadvisor: (outscraper.sources?.tripadvisor ?? 0),
        lemon8: (weddingPlatforms.sources?.lemon8 ?? 0),
        bridely: (weddingPlatforms.sources?.bridely ?? 0),
      },
      sourceErrors: {
        ...(outscraper.errors || {}),
        ...(weddingPlatforms.errors || {}),
      },
      overall_score: toNum(scored.overall_score),
      food_score: toNum(scored.food_score),
      service_score: toNum(scored.service_score),
      atmosphere_score: toNum(scored.atmosphere_score),
      coordination_score: toNum(scored.coordination_score),
      reviews: mergedReviews,
      team_mentions: scored.team_mentions || [],
      top_positives: scored.top_positives || [],
      top_negatives: scored.top_negatives || [],
      improvement_areas: scored.improvement_areas || [],
    });

  } catch (error) {
    console.error('Wedding reviews API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
