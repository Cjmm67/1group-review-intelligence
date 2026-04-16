import { fetchAllReviews } from '@/lib/outscraper';
import { scoreReviews } from '@/lib/claude';

// Vercel serverless timeout ceiling (seconds). Each competitor call
// must finish within this window or the response returns empty.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query,
      competitorName,
      competitorType,
      reviewsLimit,        // legacy single-value param
      googleLimit,         // new explicit param
      tripAdvisorLimit,    // new explicit param
      // Default OFF for competitors — TripAdvisor async polling can push
      // a single call past 60s, which stalls the whole 10-competitor
      // sequential sweep. Callers can opt in per-venue when needed.
      includeTripAdvisor = false,
    } = body;

    if (!query) {
      return Response.json({ error: 'Missing query (Google Maps URL or venue name + location)' }, { status: 400 });
    }

    // Resolve limits — smaller defaults for competitors (faster sweep)
    const gLimit = googleLimit ?? reviewsLimit ?? 20;
    const taLimit = tripAdvisorLimit ?? (reviewsLimit ? Math.max(8, Math.round(reviewsLimit * 0.6)) : 15);

    // Step 1: Fetch from Outscraper — Google + TripAdvisor in parallel
    const outscraper = await fetchAllReviews({
      query,
      googleLimit: gLimit,
      tripAdvisorLimit: taLimit,
      includeTripAdvisor,
    });

    const reviews = outscraper.reviews || [];

    if (reviews.length === 0) {
      // Preserve legacy behaviour: HTTP 200 with nulls so the UI can still render a card
      return Response.json({
        name: competitorName || outscraper.venue,
        googleRating: outscraper.googleRating,
        tripAdvisorRating: outscraper.tripAdvisorRating,
        totalReviews: outscraper.totalReviewsGoogle,
        totalReviewsGoogle: outscraper.totalReviewsGoogle,
        totalReviewsTripAdvisor: outscraper.totalReviewsTripAdvisor,
        food_score: null,
        service_score: null,
        atmosphere_score: null,
        overall_score: outscraper.googleRating || outscraper.tripAdvisorRating || null,
        reviewCount: 0,
        sources: outscraper.sources,
        sourceErrors: outscraper.errors,
        scraped: true,
      });
    }

    // Step 2: Score reviews with Claude
    const scored = await scoreReviews({
      venueName: competitorName || outscraper.venue,
      venueType: competitorType || 'Restaurant',
      reviews,
    });

    const toNum = v => (typeof v === 'number' && !isNaN(v)) ? v : 0;

    return Response.json({
      name: competitorName || outscraper.venue,
      googleRating: outscraper.googleRating,
      tripAdvisorRating: outscraper.tripAdvisorRating,
      totalReviews: outscraper.totalReviewsGoogle,              // legacy field
      totalReviewsGoogle: outscraper.totalReviewsGoogle,
      totalReviewsTripAdvisor: outscraper.totalReviewsTripAdvisor,
      address: outscraper.address,
      food_score: toNum(scored.food_score),
      service_score: toNum(scored.service_score),
      atmosphere_score: toNum(scored.atmosphere_score),
      overall_score: toNum(scored.overall_score),
      reviewCount: reviews.length,
      sources: outscraper.sources,
      sourceErrors: outscraper.errors,
      top_positives: scored.top_positives || [],
      top_negatives: scored.top_negatives || [],
      team_mentions: scored.team_mentions || [],
      scraped: true,
    });

  } catch (error) {
    console.error('Competitor reviews error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
