import { fetchGoogleReviews } from '@/lib/outscraper';
import { scoreReviews } from '@/lib/claude';

export async function POST(request) {
  try {
    const body = await request.json();
    const { query, competitorName, competitorType, reviewsLimit = 20 } = body;

    if (!query) {
      return Response.json({ error: 'Missing query (Google Maps URL or venue name + location)' }, { status: 400 });
    }

    // Step 1: Fetch reviews from Outscraper
    const outscraper = await fetchGoogleReviews({
      query,
      reviewsLimit,
      sort: 'newest',
    });

    const reviews = outscraper.reviews || [];

    if (reviews.length === 0) {
      // Return just the Google rating if no reviews extracted
      return Response.json({
        name: competitorName || outscraper.venue,
        googleRating: outscraper.googleRating,
        totalReviews: outscraper.totalReviews,
        food_score: null,
        service_score: null,
        atmosphere_score: null,
        overall_score: outscraper.googleRating || null,
        reviewCount: 0,
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
      totalReviews: outscraper.totalReviews,
      address: outscraper.address,
      food_score: toNum(scored.food_score),
      service_score: toNum(scored.service_score),
      atmosphere_score: toNum(scored.atmosphere_score),
      overall_score: toNum(scored.overall_score),
      reviewCount: reviews.length,
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
