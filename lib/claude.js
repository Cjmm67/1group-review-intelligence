export async function scoreReviews({ venueName, venueType, reviews }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const summaries = reviews.slice(0, 30).map((r, i) =>
    `${i + 1}. ${r.rating || '?'}★ by ${r.author || 'Anonymous'} (${r.date}): "${(r.text || '').slice(0, 200)}"`
  ).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You score restaurant reviews for 1-Group Singapore. For each review, score food/service/atmosphere 1-5. Extract themes and staff names. PARAPHRASE all reviews. All scores MUST be numbers (never null). Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Score these ${reviews.length} reviews for "${venueName}" (${venueType}):\n\n${summaries}\n\nReturn JSON:\n{"overall_score":3.8,"food_score":3.8,"service_score":3.7,"atmosphere_score":4.0,"reviews":[{"food_score":4,"service_score":4,"atmosphere_score":4,"sentiment":"positive","summary":"Brief paraphrase under 15 words","key_themes":["theme"],"team_members":[]}],"team_mentions":[{"name":"Name","role":"Server","mention_count":1,"avg_sentiment":"positive","sample_context":"Brief context"}],"top_positives":["strength1","strength2"],"top_negatives":["weakness1"],"improvement_areas":["area1"]}`
      }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(cleaned); }
  catch {
    // Try to fix truncated JSON
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON in response');
    let partial = cleaned.slice(start).replace(/,\s*"[^"]*$/s, '').replace(/,\s*$/s, '');
    const ob = (partial.match(/{/g) || []).length - (partial.match(/}/g) || []).length;
    const obk = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length;
    for (let i = 0; i < obk; i++) partial += ']';
    for (let i = 0; i < ob; i++) partial += '}';
    return JSON.parse(partial);
  }
}

export async function generateStrategy({ venueName, scores, positives, negatives, competitors }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const compList = (competitors || []).map(c => `${c.name}: ${c.googleRating || '?'}/5`).join(', ');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'Senior hospitality strategy consultant. Be specific — reference actual competitor names and scores. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Strategy for ${venueName}. Food:${scores.food} Service:${scores.service} Atmosphere:${scores.atmosphere}. Positives:${(positives || []).join(',')}. Negatives:${(negatives || []).join(',')}. Competitors: ${compList}.\n\nReturn JSON:\n{"executive_summary":"3-4 sentences","food_recommendations":[{"recommendation":"text","based_on":"source","priority":"high|medium|low"}],"service_recommendations":[],"atmosphere_recommendations":[],"quick_wins":[{"action":"text","timeline":"30 days","expected_impact":"text"}],"strategic_initiatives":[{"action":"text","timeline":"3-6 months","expected_impact":"text"}],"competitive_threats":[{"competitor":"name","threat":"text","response":"text"}],"team_action_items":[{"type":"recognition|coaching|training","detail":"text"}]}`
      }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

export async function discoverCompetitors({ venueName, venueType, cuisine, location, priceTier, occasions }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'Find Singapore restaurant competitors. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Find 10 competitors for "${venueName}" (${venueType}, ${cuisine}, ${priceTier}, ${location}). Occasions: ${(occasions || []).join(', ')}. 5 DIRECT (same cuisine/price/occasion) + 5 INDIRECT (same occasion, different cuisine).\n\nReturn JSON:\n{"competitors":[{"name":"Full Name","type":"direct|indirect","reason":"Why competitor","cuisine":"Type","location":"Area","price_range":"$$$","google_rating":4.2,"key_strengths":["s1"],"key_weaknesses":["w1"]}]}`
      }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(cleaned); }
  catch {
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON');
    let p = cleaned.slice(start).replace(/,\s*"[^"]*$/s, '').replace(/,\s*$/s, '');
    const ob = (p.match(/{/g) || []).length - (p.match(/}/g) || []).length;
    const obk = (p.match(/\[/g) || []).length - (p.match(/\]/g) || []).length;
    for (let i = 0; i < obk; i++) p += ']';
    for (let i = 0; i < ob; i++) p += '}';
    return JSON.parse(p);
  }
}
