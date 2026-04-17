// ─────────────────────────────────────────────────────────────
// 1-Group venue names — NEVER include as competitors.
// Applied both in the AI prompt and as a post-processing filter.
// ─────────────────────────────────────────────────────────────
const ONE_GROUP_VENUES = [
  '1-altitude', '1-altitude coast', '1-arden', '1-arden bar',
  '1-alfaro', '1-atico', '1-flowerhill',
  'oumi', 'kaarla', 'sol & luna', 'sol and luna', 'sol luna',
  'sol & ora', 'sol ora', 'camille', 'monti',
  'the alkaff mansion', 'alkaff mansion', 'una',
  'the summer house', 'summer house', 'botanico',
  'the river house', 'river house', 'zorba', 'mimi', 'yin', 'yang',
  'the garage', 'il giardino',
  'wildseed', 'wildseed cafe', 'wildseed bistro', 'wildseed bar',
  'la lune', 'la torre', 'fire', 'flnt', '1918',
  '1-group', '1 group', 'one group',
];

const ONE_GROUP_EXCLUSION_TEXT = `
CRITICAL: Do NOT include any 1-Group Singapore venues as competitors.
Exclude ALL of these: ${ONE_GROUP_VENUES.slice(0, 30).join(', ')}.
These are all part of the same company (1-Group Singapore). Only return
EXTERNAL competitors.`;

function filterOut1Group(competitors) {
  if (!Array.isArray(competitors)) return [];
  return competitors.filter(c => {
    const name = (c.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return !ONE_GROUP_VENUES.some(v => {
      const vNorm = v.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return name.includes(vNorm) || vNorm.includes(name);
    });
  });
}

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

export async function generateStrategy({ venueName, scores, positives, negatives, competitors, additionalContext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const compList = (competitors || []).map(c => `${c.name}: ${c.googleRating || '?'}/5`).join(', ');
  const extra = additionalContext ? `\n\nADDITIONAL INSTRUCTIONS: ${additionalContext}` : '';

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
        content: `Strategy for ${venueName}. Food:${scores.food} Service:${scores.service} Atmosphere:${scores.atmosphere}. Positives:${(positives || []).join(',')}. Negatives:${(negatives || []).join(',')}. Competitors: ${compList}.${extra}\n\nReturn JSON:\n{"executive_summary":"3-4 sentences","food_recommendations":[{"recommendation":"text","based_on":"source","priority":"high|medium|low"}],"service_recommendations":[],"atmosphere_recommendations":[],"quick_wins":[{"action":"text","timeline":"30 days","expected_impact":"text"}],"strategic_initiatives":[{"action":"text","timeline":"3-6 months","expected_impact":"text"}],"competitive_threats":[{"competitor":"name","threat":"text","response":"text"}],"team_action_items":[{"type":"recognition|coaching|training","detail":"text"}]}`
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
      system: `Find Singapore restaurant competitors. ${ONE_GROUP_EXCLUSION_TEXT} Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Find 10 competitors for "${venueName}" (${venueType}, ${cuisine}, ${priceTier}, ${location}). Occasions: ${(occasions || []).join(', ')}. 5 DIRECT (same cuisine/price/occasion) + 5 INDIRECT (same occasion, different cuisine).\n\nIMPORTANT: Do NOT include any 1-Group venues (${ONE_GROUP_VENUES.slice(0, 15).join(', ')}, etc). Only EXTERNAL competitors.\n\nReturn JSON:\n{"competitors":[{"name":"Full Name","type":"direct|indirect","reason":"Why competitor","cuisine":"Type","location":"Area","price_range":"$$$","google_rating":4.2,"key_strengths":["s1"],"key_weaknesses":["w1"]}]}`
      }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let result;
  try { result = JSON.parse(cleaned); }
  catch {
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON');
    let p = cleaned.slice(start).replace(/,\s*"[^"]*$/s, '').replace(/,\s*$/s, '');
    const ob = (p.match(/{/g) || []).length - (p.match(/}/g) || []).length;
    const obk = (p.match(/\[/g) || []).length - (p.match(/\]/g) || []).length;
    for (let i = 0; i < obk; i++) p += ']';
    for (let i = 0; i < ob; i++) p += '}';
    result = JSON.parse(p);
  }

  // Strip any 1-Group venues that slipped through the prompt
  if (result?.competitors) {
    result.competitors = filterOut1Group(result.competitors);
  }
  return result;
}
// Wedding-specific review scoring
// Adds a 4th dimension: Coordination (wedding planning, timing,
// coordination between bride/groom/planner/venue team).
// ═══════════════════════════════════════════════════════════
export async function scoreWeddingReviews({ venueName, venueType, reviews }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const summaries = reviews.slice(0, 30).map((r, i) =>
    `${i + 1}. ${r.rating || '?'}★ [${r.source || 'unknown'}] by ${r.author || 'Anonymous'} (${r.date}): "${(r.text || r.summary || '').slice(0, 200)}"`
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
      system: `You are a wedding venue review analyst for 1-Group Singapore.
Score each review on FOUR dimensions (1-5):
- FOOD: banquet quality, menu options, dietary accommodation, cocktail hour, cake
- SERVICE: staff attentiveness, responsiveness, hospitality, problem resolution
- ATMOSPHERE: venue beauty, ceremony setting, reception decor, lighting, photos
- COORDINATION: wedding planning support, timeline management, rehearsal, setup/teardown, communication with couple, vendor coordination

Reviews come from Google, TripAdvisor, Lemon8, and Bridely. Weight wedding-specific
content higher than general dining reviews. Extract wedding coordinator/planner names.
PARAPHRASE all reviews. All scores MUST be numbers. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Score these ${reviews.length} wedding-related reviews for "${venueName}" (${venueType}):\n\n${summaries}\n\nReturn JSON:\n{"overall_score":3.8,"food_score":3.8,"service_score":3.7,"atmosphere_score":4.0,"coordination_score":3.9,"reviews":[{"food_score":4,"service_score":4,"atmosphere_score":4,"coordination_score":4,"sentiment":"positive","summary":"Brief paraphrase under 15 words","key_themes":["theme"],"team_members":[]}],"team_mentions":[{"name":"Name","role":"Wedding Coordinator|Server|Chef|Manager","mention_count":1,"avg_sentiment":"positive","sample_context":"Brief context"}],"top_positives":["strength1"],"top_negatives":["weakness1"],"improvement_areas":["area1"]}`
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

// ═══════════════════════════════════════════════════════════
// Wedding-specific competitor discovery
// Finds wedding venue competitors, not restaurant competitors.
// ═══════════════════════════════════════════════════════════
export async function discoverWeddingCompetitors({ venueName, venueType, location, priceTier }) {
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
      system: `You are a Singapore wedding venue competitive intelligence analyst.
Find competitors specifically for WEDDING events — not general dining.
Focus on: banquet capacity, solemnisation settings, wedding packages, similar aesthetics.
${ONE_GROUP_EXCLUSION_TEXT}
Return ONLY valid JSON. No markdown fences.`,
      messages: [{
        role: 'user',
        content: `Find 10 WEDDING VENUE competitors for "${venueName}" (${venueType}, ${priceTier}, ${location}).

IMPORTANT: Do NOT include any 1-Group Singapore venues as competitors.
Exclude: ${ONE_GROUP_VENUES.slice(0, 20).join(', ')}, and all other 1-Group properties.
Only return EXTERNAL wedding venues.

Search for:
- "best wedding venues Singapore"
- "wedding banquet venues Singapore ${priceTier}"
- "outdoor wedding venues Singapore"
- "unique wedding venues Singapore"
- "alternatives to ${venueName} wedding"
- "wedding venue near ${location} Singapore"

5 DIRECT (same style/capacity/price for weddings):
- similar venue aesthetic (garden, heritage, rooftop, waterfront)
- overlapping guest capacity
- same price tier for wedding packages

5 INDIRECT (different style but same couple demographic):
- different venue type but targets same budget
- hotel ballroom vs standalone venue
- different area but similar wedding vibe

Return JSON:
{"competitors":[{"name":"Full Venue Name","type":"direct|indirect","reason":"Why this is a wedding competitor","cuisine":"Type if restaurant","location":"Area","price_range":"$$$","google_rating":4.2,"wedding_capacity":"50-150 pax","wedding_style":"garden|ballroom|rooftop|heritage|waterfront|indoor","key_strengths":["s1"],"key_weaknesses":["w1"]}]}`
      }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let result;
  try { result = JSON.parse(cleaned); }
  catch {
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON');
    let p = cleaned.slice(start).replace(/,\s*"[^"]*$/s, '').replace(/,\s*$/s, '');
    const ob = (p.match(/{/g) || []).length - (p.match(/}/g) || []).length;
    const obk = (p.match(/\[/g) || []).length - (p.match(/\]/g) || []).length;
    for (let i = 0; i < obk; i++) p += ']';
    for (let i = 0; i < ob; i++) p += '}';
    result = JSON.parse(p);
  }

  // Strip any 1-Group venues that slipped through the prompt
  if (result?.competitors) {
    result.competitors = filterOut1Group(result.competitors);
  }
  return result;
}
