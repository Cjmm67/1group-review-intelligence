import { discoverCompetitors } from '@/lib/claude';
import { fetchGoogleReviews } from '@/lib/outscraper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { venueName, venueType, cuisine, location, priceTier, occasions } = body;

    // Step 1: AI discovers competitors
    const result = await discoverCompetitors({ venueName, venueType, cuisine, location, priceTier, occasions });

    if (!result?.competitors?.length) {
      return Response.json({ error: 'No competitors found' }, { status: 404 });
    }

    // Step 2: Enrich with Google ratings from Outscraper (optional, costs credits)
    // For now return AI-discovered data; enrichment can be added later
    return Response.json({ competitors: result.competitors });

  } catch (error) {
    console.error('Competitors API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
