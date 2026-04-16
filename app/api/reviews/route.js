import { fetchAllReviews } from '@/lib/outscraper';
import { scoreReviews } from '@/lib/claude';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query,
      venueName,
      venueType,
      reviewsLimit,        // legacy single-value param (optional)
      googleLimit,         // new explicit param (optional)
      tripAdvisorLimit,    // new explicit param (optional)
      dateFrom,
      dateTo,
      includeTripAdvisor = true,
    } = body;

    if (!query) {
      return Response.json({ error: 'Missing query (Google Maps URL or venue name)' }, { status: 400 });
    }

    // Resolve limits with sensible fallbacks.
    // If legacy reviewsLimit is present, split it (TA gets ~60% of the Google cap).
    const gLimit = googleLimit ?? reviewsLimit ?? 30;
    const taLimit = tripAdvisorLimit ?? (reviewsLimit ? Math.max(10, Math.round(reviewsLimit * 0.6)) : 20);

    // Calculate cutoff timestamp from dateFrom
    let cutoff = null;
    if (dateFrom) {
      cutoff = String(Math.floor(new Date(dateFrom).getTime() / 1000));
    }

    // Step 1: Fetch reviews from Outscraper — Google + TripAdvisor in parallel
    const outscraper = await fetchAllReviews({
      query,
      googleLimit: gLimit,
      tripAdvisorLimit: taLimit,
      cutoff,
      includeTripAdvisor,
    });

    // Filter by date range if dateTo specified
    let reviews = outscraper.reviews || [];
    if (dateTo) {
      const toDate = new Date(dateTo);
      reviews = reviews.filter(r => {
        if (!r.date) return true;
        return new Date(r.date) <= toDate;
      });
    }

    if (reviews.length === 0) {
      return Response.json({
        venue: outscraper.venue,
        googleRating: outscraper.googleRating,
        tripAdvisorRating: outscraper.tripAdvisorRating,
        totalReviews: outscraper.totalReviewsGoogle,   // legacy field
        totalReviewsGoogle: outscraper.totalReviewsGoogle,
        totalReviewsTripAdvisor: outscraper.totalReviewsTripAdvisor,
        reviews: [],
        scores: null,
        sources: outscraper.sources,
        sourceErrors: outscraper.errors,
        message: 'No reviews found in the specified date range.',
      });
    }

    // Step 2: Score reviews with Claude AI
    const scored = await scoreReviews({
      venueName: venueName || outscraper.venue,
      venueType: venueType || 'Restaurant',
      reviews,
    });

    // Step 3: Merge Outscraper raw data with AI scores
    const toNum = v => (typeof v === 'number' && !isNaN(v)) ? v : 0;
    const mergedReviews = reviews.map((raw, i) => {
      const ai = scored.reviews?.[i] || {};
      const fallback = raw.rating >= 4 ? 4 : raw.rating >= 3 ? 3 : 2;
      return {
        ...raw,  // preserves source, sourceLabel, id, author, date, rating, text, title, tripType
        food_score: toNum(ai.food_score) || fallback,
        service_score: toNum(ai.service_score) || fallback,
        atmosphere_score: toNum(ai.atmosphere_score) || fallback,
        sentiment: ai.sentiment || raw.sentiment,
        summary: ai.summary || (raw.text || '').slice(0, 120),
        key_themes: ai.key_themes || [],
        team_members: ai.team_members || [],
      };
    });

    return Response.json({
      venue: outscraper.venue,
      googleRating: outscraper.googleRating,
      tripAdvisorRating: outscraper.tripAdvisorRating,
      totalReviews: outscraper.totalReviewsGoogle,            // legacy field for back-compat
      totalReviewsGoogle: outscraper.totalReviewsGoogle,
      totalReviewsTripAdvisor: outscraper.totalReviewsTripAdvisor,
      address: outscraper.address,
      scrapeDate: new Date().toISOString().split('T')[0],
      period: `${dateFrom || 'all'} to ${dateTo || 'now'}`,
      reviewCount: mergedReviews.length,
      sources: outscraper.sources,                             // { google: n, tripadvisor: n }
      sourceErrors: outscraper.errors,                         // { google: null|msg, tripadvisor: null|msg }
      overall_score: toNum(scored.overall_score),
      food_score: toNum(scored.food_score),
      service_score: toNum(scored.service_score),
      atmosphere_score: toNum(scored.atmosphere_score),
      reviews: mergedReviews,
      team_mentions: scored.team_mentions || [],
      top_positives: scored.top_positives || [],
      top_negatives: scored.top_negatives || [],
      improvement_areas: scored.improvement_areas || [],
    });

  } catch (error) {
    console.error('Reviews API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
