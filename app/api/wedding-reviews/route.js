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
    // Google/TripAdvisor via Outscraper — we pull a LARGER pool because
    // most reviews will be general dining; we hard-filter for wedding
    // keywords afterwards. Only wedding-relevant reviews survive.
    const outscraperTask = fetchAllReviews({
      query: query || `${venueName} Singapore`,
      googleLimit: Math.max(googleLimit, 80),   // bigger pool — most get filtered out
      tripAdvisorLimit: Math.max(tripAdvisorLimit, 40),
      cutoff,
      includeTripAdvisor: true,
    }).catch(e => ({
      venue: venueName, reviews: [], sources: { google: 0, tripadvisor: 0 },
      errors: { google: e?.message, tripadvisor: null },
    }));

    // Lemon8 + Bridely via Claude + web_search (already wedding-specific)
    const weddingPlatformsTask = scrapeWeddingPlatforms({
      venueName: venueName || query,
      parentVenueName,
    }).catch(e => ({
      allReviews: [], sources: { lemon8: 0, bridely: 0 },
      errors: { lemon8: e?.message, bridely: e?.message },
    }));

    const [outscraper, weddingPlatforms] = await Promise.all([outscraperTask, weddingPlatformsTask]);

    // ── Step 2: STRICT FILTER — wedding-only reviews ──
    // The review text MUST contain the word "wedding" or an unmistakably
    // bridal/matrimonial term. We deliberately EXCLUDE loose terms like:
    //   - "banquet" (matches corporate/CNY banquets)
    //   - "reception" (matches hotel front desk, corporate events)
    //   - "ceremony" (matches tea ceremony, award ceremony)
    //   - "vow" (matches "I vow to return")
    //   - "bouquet" (matches "bouquet of flavours" in wine reviews)
    //   - "ROM" alone (too ambiguous)
    //   - "i do" (matches "I do recommend this place")
    //   - "wed" alone (matches "Wednesday")
    //   - "table setting" / "floral arrangement" (matches any event)
    //
    // PASS if review contains ANY of these:
    //   • "wedding" (the gold standard — covers wedding dinner, wedding
    //     banquet, wedding venue, wedding planner, our wedding, etc.)
    //   • "bride" / "bridal" / "bridesmaid"
    //   • "groom" / "groomsman" / "groomsmen"
    //   • "solemnisation" / "solemnization"
    //   • "nuptial" / "nuptials"
    //   • "matrimon" (matrimony / matrimonial)
    //   • "ROM ceremony" / "ROM solemnisation" (only ROM with context)
    //   • "walk down the aisle"
    //   • "first dance"
    //   • "bridal party"
    //   • "hen party" / "hen night"
    //   • "bachelorette"
    //
    // This is intentionally strict. A review about a birthday dinner
    // that happens to mention "this would be great for celebrations"
    // will NOT pass. Only genuinely wedding-related reviews survive.

    const WEDDING_STRICT = /\bwedding\b|\bbride\b|\bbridal\b|\bbridesmaid|\bgroom\b|\bgroomsmen?\b|\bsolemnisation|\bsolemnization|\bnuptial|\bmatrimon|\bROM\s+(?:ceremony|solemnisation|day|celebration)|\bwalk(?:ed|ing)?\s+down\s+the\s+aisle|\bfirst\s+dance|\bbridal\s+party|\bhen\s+(?:party|night|do)\b|\bbachelorette/i;

    const outscraperReviews = (outscraper.reviews || []).filter(r => {
      const combined = `${r.text || ''} ${r.title || ''}`;
      return WEDDING_STRICT.test(combined);
    });

    const totalGoogleTA = (outscraper.reviews || []).length;
    const filteredCount = outscraperReviews.length;

    // Merge: filtered Google/TA + all Lemon8/Bridely (already wedding-specific)
    const allReviews = [...outscraperReviews, ...(weddingPlatforms.allReviews || [])];

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
        totalScanned: totalGoogleTA,
        weddingRelevantCount: 0,
        message: `Scanned ${totalGoogleTA} Google/TripAdvisor reviews but none contained the word "wedding", "bride", "groom", or other strict bridal terms. This venue may have few public wedding reviews — check Lemon8/Bridely results or try a venue with stronger wedding presence (e.g. The Alkaff Mansion, The Summer House).`,
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
      totalScanned: totalGoogleTA,
      weddingRelevantCount: filteredCount + (weddingPlatforms.allReviews || []).length,
      sources: {
        google: outscraperReviews.filter(r => r.source === 'google').length,
        tripadvisor: outscraperReviews.filter(r => r.source === 'tripadvisor').length,
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
