// app/api/wedding-competitors/route.js
import { discoverWeddingCompetitors } from '@/lib/claude';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { venueName, venueType, location, priceTier } = body;

    const result = await discoverWeddingCompetitors({
      venueName, venueType, location, priceTier,
    });

    if (!result?.competitors?.length) {
      return Response.json({ error: 'No wedding competitors found' }, { status: 404 });
    }

    return Response.json({ competitors: result.competitors });
  } catch (error) {
    console.error('Wedding competitors API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
