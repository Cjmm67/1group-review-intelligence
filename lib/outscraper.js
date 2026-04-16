// lib/outscraper.js
// Unified Outscraper client: Google Maps Reviews + TripAdvisor Reviews.
// Both sources are fetched in parallel and merged with deduplication.
// TripAdvisor often flips to async mode, so we poll /requests/{id} when
// the initial response comes back Pending.

const OUTSCRAPER_BASE = 'https://api.outscraper.cloud';

// ─────────────────────────────────────────────────────────────
// Query normalisation — resolves Google Maps short links.
// maps.app.goo.gl/xxx doesn't carry business info; Outscraper
// doesn't always follow the redirect, so we resolve it here
// and hand Outscraper the canonical URL.
// ─────────────────────────────────────────────────────────────
async function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return query;
  const trimmed = query.trim();
  // Short-link forms that need resolution
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(trimmed)) {
    try {
      const res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 1GroupReviewBot)' },
      });
      if (res.url && res.url !== trimmed) return res.url;
    } catch {
      // fall through — Outscraper gets the short link as-is
    }
  }
  return trimmed;
}

// Extract a human-readable place name from a resolved Maps URL
// (used as a fallback query when the full URL returns nothing).
function extractPlaceNameFromMapsUrl(url) {
  if (!url) return null;
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    return m[1].replace(/\+/g, ' ');
  }
}

// ─────────────────────────────────────────────────────────────
// Low-level request helper — handles sync + async polling.
// ─────────────────────────────────────────────────────────────
async function outscraperGet(path, params, {
  pollMaxMs = 120000,
  pollIntervalMs = 3000,
  fetchTimeoutMs = 150000,
} = {}) {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY not configured');

  const url = new URL(`${OUTSCRAPER_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-API-KEY': apiKey },
    signal: AbortSignal.timeout(fetchTimeoutMs),
  });

  if (!res.ok && res.status !== 202) {
    const body = await res.text().catch(() => '');
    throw new Error(`Outscraper ${path} ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json();

  // Async mode: { id, status: 'Pending' | 'Success' }
  const requestId = payload?.id;
  const status = payload?.status;
  if (requestId && status && status !== 'Success') {
    return await pollForResult(requestId, apiKey, { pollMaxMs, pollIntervalMs });
  }

  return payload;
}

async function pollForResult(requestId, apiKey, { pollMaxMs, pollIntervalMs }) {
  const start = Date.now();
  while (Date.now() - start < pollMaxMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    try {
      const res = await fetch(`${OUTSCRAPER_BASE}/requests/${requestId}`, {
        headers: { 'X-API-KEY': apiKey },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const status = data?.status;
      if (status === 'Success' || status === 'SUCCESS') return data;
      if (status === 'Failure' || status === 'FAILED') {
        throw new Error(`Outscraper request ${requestId} failed`);
      }
    } catch (e) {
      if (String(e?.message || '').includes('failed')) throw e;
    }
  }
  throw new Error(`Outscraper request ${requestId} timed out after ${pollMaxMs}ms`);
}

// ─────────────────────────────────────────────────────────────
// Normalise response shape — Outscraper nests data differently
// between sync and async responses.
// ─────────────────────────────────────────────────────────────
function extractPlaceData(payload) {
  let root = payload?.data ?? payload;
  if (Array.isArray(root) && Array.isArray(root[0])) root = root[0];
  if (Array.isArray(root)) root = root[0];
  return root || null;
}

function sentimentFromRating(r) {
  if (r >= 4) return 'positive';
  if (r >= 3) return 'neutral';
  return 'negative';
}

// ─────────────────────────────────────────────────────────────
// Google Maps Reviews  (signature preserved from prior version)
// ─────────────────────────────────────────────────────────────
export async function fetchGoogleReviews({
  query,
  reviewsLimit = 50,
  sort = 'newest',
  cutoff = null,
} = {}) {
  const resolvedQuery = await normalizeQuery(query);

  let payload = await outscraperGet('/maps/reviews-v3', {
    query: resolvedQuery,
    reviewsLimit,
    sort,
    cutoff,
    async: 'false',
  });

  let place = extractPlaceData(payload);

  // Fallback: if the full Maps URL returned nothing, retry with the
  // extracted place name (e.g. "Una at The Alkaff Mansion"). Some
  // Outscraper dispatches fail on long URLs but succeed on names.
  if (!place && /\/maps\/place\//i.test(resolvedQuery)) {
    const placeName = extractPlaceNameFromMapsUrl(resolvedQuery);
    if (placeName) {
      payload = await outscraperGet('/maps/reviews-v3', {
        query: placeName, reviewsLimit, sort, cutoff, async: 'false',
      });
      place = extractPlaceData(payload);
    }
  }

  if (!place) {
    return {
      venue: query,
      reviews: [],
      googleRating: null,
      totalReviews: 0,
      attemptedQuery: resolvedQuery,
    };
  }

  const reviews = (place.reviews_data || []).map((r, i) => ({
    id: `g${String(i + 1).padStart(3, '0')}`,
    source: 'google',
    sourceLabel: 'Google',
    date: r.review_datetime_utc?.slice(0, 10) || '',
    rating: r.review_rating || null,
    author: r.author_title || r.autor_name || '',
    text: r.review_text || '',
    sentiment: sentimentFromRating(r.review_rating || 0),
    reviewUrl: r.review_link || '',
  }));

  return {
    venue: place.name || query,
    googleRating: place.rating ?? null,
    totalReviews: place.reviews ?? 0,
    address: place.full_address || place.address || '',
    placeId: place.place_id || '',
    reviews,
    attemptedQuery: resolvedQuery,
  };
}

// ─────────────────────────────────────────────────────────────
// TripAdvisor Reviews  (real implementation — previously a stub)
// Endpoint: /tripadvisor-reviews
// Accepts TripAdvisor URL OR free-text query (e.g. "Oumi Singapore").
// ─────────────────────────────────────────────────────────────
export async function fetchTripAdvisorReviews({
  query,
  reviewsLimit = 30,
  cutoff = null,
} = {}) {
  try {
    const resolvedQuery = await normalizeQuery(query);
    const payload = await outscraperGet('/tripadvisor-reviews', {
      query: resolvedQuery,
      reviewsLimit,
      cutoff,
      async: 'false',
    }, {
      pollMaxMs: 180000,  // TA is slower — allow 3 min for async polling
    });

    const place = extractPlaceData(payload);
    if (!place) {
      return { venue: query, reviews: [], tripAdvisorRating: null, totalReviews: 0, source: 'tripadvisor' };
    }

    const reviewsArr = place.reviews_data || place.reviews || [];
    const reviews = reviewsArr.map((r, i) => {
      const rating = r.rating ?? r.review_rating ?? null;
      const rawDate = r.published_date || r.date_of_visit || r.review_datetime_utc || '';
      return {
        id: `t${String(i + 1).padStart(3, '0')}`,
        source: 'tripadvisor',
        sourceLabel: 'TripAdvisor',
        date: typeof rawDate === 'string' ? rawDate.slice(0, 10) : '',
        rating,
        author: r.user_name || r.autor_name || r.user?.username || '',
        title: r.review_title || r.title || '',
        text: r.review_text || r.text || '',
        tripType: r.trip_type || null,
        sentiment: sentimentFromRating(rating || 0),
        reviewUrl: r.url || r.review_link || '',
      };
    });

    return {
      venue: place.name || place.title || query,
      tripAdvisorRating: place.rating ?? place.average_rating ?? null,
      totalReviews: place.reviews_count ?? place.review_count ?? reviews.length,
      address: place.address || place.full_address || '',
      placeId: place.location_id || place.place_id || '',
      reviews,
      source: 'tripadvisor',
    };
  } catch (err) {
    return {
      venue: query,
      reviews: [],
      tripAdvisorRating: null,
      totalReviews: 0,
      source: 'tripadvisor',
      error: err?.message || String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Unified multi-source fetcher
// Runs Google + TripAdvisor in parallel. If one fails, the other
// still returns. Reviews are tagged with source and deduplicated.
// ─────────────────────────────────────────────────────────────
export async function fetchAllReviews({
  query,
  googleLimit = 50,
  tripAdvisorLimit = 30,
  cutoff = null,
  includeTripAdvisor = true,
} = {}) {
  const googleTask = fetchGoogleReviews({ query, reviewsLimit: googleLimit, cutoff })
    .then(r => ({ ok: true, value: r }))
    .catch(e => ({ ok: false, error: e?.message, value: { reviews: [] } }));

  const tripTask = includeTripAdvisor
    ? fetchTripAdvisorReviews({ query, reviewsLimit: tripAdvisorLimit, cutoff })
        .then(r => ({ ok: !r.error, value: r, error: r.error }))
        .catch(e => ({ ok: false, error: e?.message, value: { reviews: [] } }))
    : Promise.resolve({ ok: true, value: { reviews: [] }, error: null });

  const [googleOut, tripOut] = await Promise.all([googleTask, tripTask]);
  const google = googleOut.value || { reviews: [] };
  const trip = tripOut.value || { reviews: [] };

  const combined = [...(google.reviews || []), ...(trip.reviews || [])];
  const deduped = deduplicateReviews(combined);

  return {
    venue: google.venue || trip.venue || query,
    googleRating: google.googleRating ?? null,
    tripAdvisorRating: trip.tripAdvisorRating ?? null,
    address: google.address || trip.address || '',
    placeId: google.placeId || trip.placeId || '',
    totalReviewsGoogle: google.totalReviews ?? 0,
    totalReviewsTripAdvisor: trip.totalReviews ?? 0,
    attemptedQuery: google.attemptedQuery || query,
    reviews: deduped,
    sources: {
      google: (google.reviews || []).length,
      tripadvisor: (trip.reviews || []).length,
    },
    errors: {
      google: googleOut.ok ? null : googleOut.error,
      tripadvisor: tripOut.ok ? null : tripOut.error,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Dedup — same reviewer frequently cross-posts. Keep first match,
// prefer Google (more reliable rating data).
// ─────────────────────────────────────────────────────────────
function deduplicateReviews(reviews) {
  const seen = new Map();
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);

  const ordered = [...reviews].sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === 'google' ? -1 : 1;
  });

  for (const r of ordered) {
    const key = `${norm(r.author)}|${r.rating || 0}|${(r.date || '').slice(0, 7)}|${norm(r.text).slice(0, 40)}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
}
