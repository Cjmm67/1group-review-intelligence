import { generateStrategy } from '@/lib/claude';

export async function POST(request) {
  try {
    const body = await request.json();
    const { venueName, scores, positives, negatives, competitors } = body;

    const result = await generateStrategy({ venueName, scores, positives, negatives, competitors });
    return Response.json(result);

  } catch (error) {
    console.error('Strategy API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
