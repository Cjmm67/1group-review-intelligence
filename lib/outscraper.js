const OUTSCRAPER_BASE = 'https://api.outscraper.cloud';

export async function fetchGoogleReviews({ query, reviewsLimit = 50, sort = 'newest', cutoff = null }) {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY not configured');

  const params = new URLSearchParams({
    query,
    reviewsLimit: String(reviewsLimit),
    sort,
    async: 'false',
  });

  if (cutoff) params.set('cutoff', cutoff); // Unix timestamp - reviews older than this are excluded

  const response = await fetch(`${OUTSCRAPER_BASE}/maps/reviews-v3?${params}`, {
    headers: { 'X-API-KEY': apiKey },
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Outscraper API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();

  // Outscraper returns { data: [{ name, reviews_data: [...] }] }
  if (!data?.data?.[0]) return { venue: query, reviews: [], rating: null, totalReviews: 0 };

  const place = data.data[0];
  const reviews = (place.reviews_data || []).map((r, i) => ({
    id: `r${String(i + 1).padStart(3, '0')}`,
    source: 'google',
    date: r.review_datetime_utc?.slice(0, 10) || '',
    rating: r.review_rating || null,
    author: r.author_title || '',
    text: r.review_text || '',
    sentiment: r.review_rating >= 4 ? 'positive' : r.review_rating >= 3 ? 'neutral' : 'negative',
    reviewUrl: r.review_link || '',
  }));

  return {
    venue: place.name || query,
    googleRating: place.rating || null,
    totalReviews: place.reviews || 0,
    address: place.full_address || '',
    placeId: place.place_id || '',
    reviews,
  };
}

export async function fetchTripAdvisorReviews({ query }) {
  // TripAdvisor requires separate scraping - for now return empty
  // Can be added via Outscraper's TripAdvisor API endpoint later
  return { venue: query, reviews: [], source: 'tripadvisor' };
}
