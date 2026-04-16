import { fetchGoogleReviews } from '@/lib/outscraper';
import { scoreReviews } from '@/lib/claude';

export async function POST(request) {
  try {
    const body = await request.json();
    const { query, venueName, venueType, reviewsLimit = 30, dateFrom, dateTo } = body;

    if (!query) {
      return Response.json({ error: 'Missing query (Google Maps URL or venue name)' }, { status: 400 });
    }

    // Calculate cutoff timestamp from dateFrom
    let cutoff = null;
    if (dateFrom) {
      cutoff = String(Math.floor(new Date(dateFrom).getTime() / 1000));
    }

    // Step 1: Fetch reviews from Outscraper
    const outscraper = await fetchGoogleReviews({
      query,
      reviewsLimit,
      sort: 'newest',
      cutoff,
    });

    // Filter by date range if dateTo specified
    let reviews = outscraper.reviews;
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
        totalReviews: outscraper.totalReviews,
        reviews: [],
        scores: null,
        message: 'No reviews found in the specified date range.',
      });
    }

    // Step 2: Score reviews with Claude AI
    const scored = await scoreReviews({
      venueName: venueName || outscraper.venue,
      venueType: venueType || 'Restaurant',
      reviews,
    });

    // Merge Outscraper raw data with AI scores
    const toNum = v => (typeof v === 'number' && !isNaN(v)) ? v : 0;
    const mergedReviews = reviews.map((raw, i) => {
      const ai = scored.reviews?.[i] || {};
      return {
        ...raw,
        food_score: toNum(ai.food_score) || (raw.rating >= 4 ? 4 : raw.rating >= 3 ? 3 : 2),
        service_score: toNum(ai.service_score) || (raw.rating >= 4 ? 4 : raw.rating >= 3 ? 3 : 2),
        atmosphere_score: toNum(ai.atmosphere_score) || (raw.rating >= 4 ? 4 : raw.rating >= 3 ? 3 : 2),
        sentiment: ai.sentiment || raw.sentiment,
        summary: ai.summary || raw.text?.slice(0, 80),
        key_themes: ai.key_themes || [],
        team_members: ai.team_members || [],
      };
    });

    return Response.json({
      venue: outscraper.venue,
      googleRating: outscraper.googleRating,
      totalReviews: outscraper.totalReviews,
      address: outscraper.address,
      scrapeDate: new Date().toISOString().split('T')[0],
      period: `${dateFrom || 'all'} to ${dateTo || 'now'}`,
      reviewCount: mergedReviews.length,
      sources: { google: mergedReviews.length },
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
