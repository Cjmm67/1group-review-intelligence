// lib/docx-report.js
// Produces editable Microsoft Word (.docx) reports for every tab of the
// 1-Group Review Intelligence tool. Replaces the prior plain-text exports
// with rich formatting: headings, tables, colored accents, brand typography.
//
// Builders (one per tab + one combined):
//   downloadDashboardReport   → Dashboard scores + summary
//   downloadReviewsReport     → Individual reviews with per-review scoring
//   downloadTeamReport        → Team member recognition
//   downloadCompetitorsReport → Competitor profiles (Direct / Indirect / Custom)
//   downloadBenchmarksReport  → Ranking table + gap analysis
//   downloadStrategyReport    → AI strategic recommendations
//   downloadFullReport        → Everything combined into one document
//
// All builders save directly to the user's Downloads via browser blob
// download. File extension is always .docx.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak,
} from 'docx';

// ─────────────────────────────────────────────────────────────
// Brand palette (hex, no leading '#')
// ─────────────────────────────────────────────────────────────
const NAVY    = '1a1a2e';
const GOLD    = 'c9a84c';
const POS     = '28a745';
const NEG     = 'dc3545';
const WARN    = 'fd7e14';
const MUT     = '6c757d';
const BORDER  = 'e9ecef';

// ─────────────────────────────────────────────────────────────
// Low-level helpers
// ─────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

function colorForScore(score) {
  const s = Number(score) || 0;
  if (s >= 4.5) return POS;
  if (s >= 4.0) return '7cb342';
  if (s >= 3.5) return WARN;
  if (s >= 3.0) return 'ff9800';
  if (s >= 2.0) return NEG;
  return 'b71c1c';
}

function labelForScore(score) {
  const s = Number(score) || 0;
  if (s >= 4.5) return 'Excellent';
  if (s >= 4.0) return 'Very Good';
  if (s >= 3.5) return 'Good';
  if (s >= 3.0) return 'Average';
  if (s >= 2.0) return 'Below Average';
  return 'Poor';
}

// Plain paragraph with one TextRun
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    ...opts.paragraph,
    children: [new TextRun({ text: String(text ?? ''), ...opts })],
  });
}

// Blank spacer
const spacer = () => new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } });

// Bold paragraph
function bold(text, opts = {}) {
  return p(text, { bold: true, ...opts });
}

// Heading with brand styling
function h1(text, color = NAVY) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color, size: 32, font: 'Georgia' })],
  });
}

function h2(text, color = NAVY) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color, size: 26, font: 'Georgia' })],
  });
}

function h3(text, color = GOLD) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, color, size: 22, font: 'Georgia' })],
  });
}

// Bulleted list item (native Word bullet styling via 'Bullet' list level)
function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: String(text ?? ''), ...opts })],
  });
}

// Multi-run paragraph (useful for "Label: value" lines with mixed styling)
function mixedP(runs, paragraphOpts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    ...paragraphOpts,
    children: runs.map(r => r instanceof TextRun ? r : new TextRun(r)),
  });
}

// Brand header block at the top of every report
function brandHeader(title, venueName) {
  return [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: '1-GROUP REVIEW INTELLIGENCE', bold: true, color: GOLD, size: 20, font: 'Georgia' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: String(venueName || '').toUpperCase(), bold: true, color: NAVY, size: 44, font: 'Georgia' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: title, italics: true, color: NAVY, size: 24, font: 'Georgia' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { color: GOLD, size: 12, style: BorderStyle.SINGLE } },
      children: [
        new TextRun({ text: `Generated ${today()}`, color: MUT, size: 18 }),
      ],
    }),
  ];
}

// Standard footer note
function footer() {
  return [
    spacer(),
    new Paragraph({
      border: { top: { color: BORDER, size: 6, style: BorderStyle.SINGLE } },
      spacing: { before: 240 },
      children: [
        new TextRun({ text: 'Generated by 1-Group Review Intelligence · Powered by Outscraper + Claude AI',
                      italics: true, color: MUT, size: 16 }),
      ],
    }),
  ];
}

// ─────────────────────────────────────────────────────────────
// Table builder — thin wrapper to keep cell construction tidy
// ─────────────────────────────────────────────────────────────
function cell({ text, bold: bld = false, color, bg, width, align }) {
  const run = new TextRun({ text: String(text ?? ''), bold: bld, color });
  const opts = {
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT,
      children: [run],
    })],
    verticalAlign: 'center',
  };
  if (width) opts.width = { size: width, type: WidthType.PERCENTAGE };
  if (bg) opts.shading = { type: ShadingType.CLEAR, fill: bg };
  return new TableCell(opts);
}

function simpleTable(rows, { headerBg = NAVY, headerColor = 'ffffff' } = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      left:   { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      right:  { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: BORDER },
    },
    rows: rows.map((r, i) => new TableRow({
      children: r.map(c => {
        if (i === 0) {
          return cell({ ...c, bold: true, color: headerColor, bg: headerBg });
        }
        return cell(c);
      }),
    })),
  });
}

// ─────────────────────────────────────────────────────────────
// Save blob as download
// ─────────────────────────────────────────────────────────────
async function save(doc, filename) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Assemble a Document with default styling + sections
function buildDoc(children) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },  // 11pt
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children,
    }],
  });
}

// ═════════════════════════════════════════════════════════════
// BUILDER 1 — DASHBOARD SCORES SNAPSHOT
// ═════════════════════════════════════════════════════════════
export async function downloadDashboardReport({ venue, rd }) {
  if (!venue || !rd) return;
  const children = [
    ...brandHeader('Dashboard — Score Snapshot', venue.name),

    h1('Overall Scores'),
    simpleTable([
      [{ text: 'Dimension' }, { text: 'Score' }, { text: 'Rating' }],
      [{ text: 'Overall' },    { text: `${rd.overall_score}/5.0`,    color: colorForScore(rd.overall_score),    bold: true }, { text: labelForScore(rd.overall_score) }],
      [{ text: 'Food' },       { text: `${rd.food_score}/5.0`,       color: colorForScore(rd.food_score),       bold: true }, { text: labelForScore(rd.food_score) }],
      [{ text: 'Service' },    { text: `${rd.service_score}/5.0`,    color: colorForScore(rd.service_score),    bold: true }, { text: labelForScore(rd.service_score) }],
      [{ text: 'Atmosphere' }, { text: `${rd.atmosphere_score}/5.0`, color: colorForScore(rd.atmosphere_score), bold: true }, { text: labelForScore(rd.atmosphere_score) }],
    ]),
    spacer(),

    h2('Context'),
    mixedP([
      new TextRun({ text: 'Google Rating: ', bold: true }),
      new TextRun({ text: String(rd.googleRating ?? 'N/A'), color: GOLD, bold: true }),
    ]),
    rd.tripAdvisorRating != null ? mixedP([
      new TextRun({ text: 'TripAdvisor Rating: ', bold: true }),
      new TextRun({ text: String(rd.tripAdvisorRating), color: GOLD, bold: true }),
    ]) : p(''),
    mixedP([
      new TextRun({ text: 'Reviews Analysed: ', bold: true }),
      new TextRun({ text: String(rd.reviewCount || rd.reviews?.length || 0) }),
    ]),
    mixedP([
      new TextRun({ text: 'Period: ', bold: true }),
      new TextRun({ text: String(rd.period || 'All time') }),
    ]),
    rd.sources ? mixedP([
      new TextRun({ text: 'Sources: ', bold: true }),
      new TextRun({ text: `Google ${rd.sources.google ?? 0}, TripAdvisor ${rd.sources.tripadvisor ?? 0}` }),
    ]) : p(''),
    spacer(),

    h2('Strengths', POS),
    ...(rd.top_positives || []).map(s => bullet(s)),
    spacer(),

    h2('Weaknesses', NEG),
    ...(rd.top_negatives || []).map(s => bullet(s)),
    ...footer(),
  ];
  await save(buildDoc(children), `${venue.id}-dashboard-${today()}`);
}

// ═════════════════════════════════════════════════════════════
// BUILDER 2 — REVIEWS REPORT
// ═════════════════════════════════════════════════════════════
export async function downloadReviewsReport({ venue, rd }) {
  if (!venue || !rd) return;
  const children = [
    ...brandHeader('Review Analysis Report', venue.name),

    h1('Summary Scores'),
    simpleTable([
      [{ text: 'Dimension' }, { text: 'Score' }, { text: 'Rating' }],
      [{ text: 'Overall' },    { text: `${rd.overall_score}/5.0`,    color: colorForScore(rd.overall_score),    bold: true }, { text: labelForScore(rd.overall_score) }],
      [{ text: 'Food' },       { text: `${rd.food_score}/5.0`,       color: colorForScore(rd.food_score),       bold: true }, { text: labelForScore(rd.food_score) }],
      [{ text: 'Service' },    { text: `${rd.service_score}/5.0`,    color: colorForScore(rd.service_score),    bold: true }, { text: labelForScore(rd.service_score) }],
      [{ text: 'Atmosphere' }, { text: `${rd.atmosphere_score}/5.0`, color: colorForScore(rd.atmosphere_score), bold: true }, { text: labelForScore(rd.atmosphere_score) }],
    ]),
    spacer(),

    mixedP([
      new TextRun({ text: 'Reviews Analysed: ', bold: true }),
      new TextRun({ text: String(rd.reviewCount || rd.reviews?.length || 0) }),
      new TextRun({ text: '    ' }),
      new TextRun({ text: 'Period: ', bold: true }),
      new TextRun({ text: String(rd.period || 'All time') }),
    ]),
    rd.sources ? mixedP([
      new TextRun({ text: 'Sources: ', bold: true }),
      new TextRun({ text: `Google ${rd.sources.google ?? 0}, TripAdvisor ${rd.sources.tripadvisor ?? 0}` }),
    ]) : p(''),
    spacer(),

    h2('Strengths', POS),
    ...(rd.top_positives || []).map(s => bullet(s)),
    spacer(),

    h2('Weaknesses', NEG),
    ...(rd.top_negatives || []).map(s => bullet(s)),
    spacer(),

    h2('Improvement Areas', WARN),
    ...(rd.improvement_areas || []).map(s => bullet(s)),
    spacer(),

    h2('Team Member Recognition'),
    ...((rd.team_mentions || []).length
      ? (rd.team_mentions || []).map(m => bullet(
          `${m.name} (${m.role}) — ${m.mention_count} mention${m.mention_count === 1 ? '' : 's'}, ${m.avg_sentiment} — "${m.sample_context}"`
        ))
      : [p('None identified in this scrape.', { italics: true, color: MUT })]),
    new Paragraph({ children: [new PageBreak()] }),

    h1('Individual Reviews'),
    ...reviewDetailBlocks(rd.reviews || []),
    ...footer(),
  ];
  await save(buildDoc(children), `${venue.id}-reviews-${today()}`);
}

function reviewDetailBlocks(reviews) {
  const out = [];
  reviews.forEach((r, i) => {
    out.push(new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({ text: `Review #${i + 1}`, bold: true, color: NAVY, size: 24 }),
        new TextRun({ text: `   ${r.sourceLabel || r.source || 'Google'}`, color: GOLD, bold: true, size: 20 }),
        new TextRun({ text: `   ${r.date || ''}`, color: MUT, size: 20 }),
        new TextRun({ text: `   ${r.author || 'Anonymous'}`, color: MUT, size: 20 }),
        new TextRun({ text: `   ${r.rating || '?'}★`, color: GOLD, bold: true, size: 20 }),
        new TextRun({ text: `   ${r.sentiment || ''}`, italics: true, color: MUT, size: 20 }),
      ],
    }));
    out.push(mixedP([
      new TextRun({ text: 'Food ', color: MUT }),
      new TextRun({ text: `${r.food_score}/5`, color: colorForScore(r.food_score), bold: true }),
      new TextRun({ text: '   Service ', color: MUT }),
      new TextRun({ text: `${r.service_score}/5`, color: colorForScore(r.service_score), bold: true }),
      new TextRun({ text: '   Atmosphere ', color: MUT }),
      new TextRun({ text: `${r.atmosphere_score}/5`, color: colorForScore(r.atmosphere_score), bold: true }),
    ]));
    if (r.title) out.push(p(r.title, { bold: true }));
    out.push(p(r.summary || (r.text || '').slice(0, 300), { italics: true }));
    if (r.key_themes?.length) {
      out.push(mixedP([
        new TextRun({ text: 'Themes: ', bold: true, color: MUT, size: 18 }),
        new TextRun({ text: r.key_themes.join(', '), color: MUT, size: 18 }),
      ]));
    }
  });
  return out;
}

// ═════════════════════════════════════════════════════════════
// BUILDER 3 — TEAM REPORT
// ═════════════════════════════════════════════════════════════
export async function downloadTeamReport({ venue, rd }) {
  if (!venue) return;
  const mentions = rd?.team_mentions || [];
  const positive = mentions.filter(m => m.avg_sentiment === 'positive');
  const neutral  = mentions.filter(m => m.avg_sentiment === 'neutral');
  const negative = mentions.filter(m => m.avg_sentiment === 'negative');

  const children = [
    ...brandHeader('Team Recognition Report', venue.name),

    mixedP([
      new TextRun({ text: 'Total Team Members Identified: ', bold: true }),
      new TextRun({ text: String(mentions.length), color: GOLD, bold: true }),
    ]),
    mixedP([
      new TextRun({ text: `${positive.length} positive · ${neutral.length} neutral · ${negative.length} needing attention`, italics: true, color: MUT }),
    ]),
    spacer(),

    h1('Star Performers', POS),
    ...(positive.length
      ? positive.map(m => teamMemberBlock(m))
      : [p('None identified with 3+ positive mentions.', { italics: true, color: MUT })]),
    spacer(),

    h1('Neutral / Mixed Mentions'),
    ...(neutral.length
      ? neutral.map(m => teamMemberBlock(m))
      : [p('No neutral mentions.', { italics: true, color: MUT })]),
    spacer(),

    h1('Attention Needed', NEG),
    ...(negative.length
      ? negative.map(m => teamMemberBlock(m))
      : [p('No negative mentions flagged.', { italics: true, color: MUT })]),
    ...footer(),
  ];
  await save(buildDoc(children), `${venue.id}-team-${today()}`);
}

function teamMemberBlock(m) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { left: { color: GOLD, size: 18, style: BorderStyle.SINGLE } },
    indent: { left: 240 },
    children: [
      new TextRun({ text: m.name, bold: true, size: 26, color: NAVY }),
      new TextRun({ text: `   (${m.role})`, color: MUT, size: 22 }),
      new TextRun({ break: 1 }),
      new TextRun({ text: `${m.mention_count} mention${m.mention_count === 1 ? '' : 's'} · ${m.avg_sentiment}`, size: 20, color: MUT }),
      new TextRun({ break: 1 }),
      new TextRun({ text: `"${m.sample_context || ''}"`, italics: true, size: 20 }),
    ],
  });
}

// ═════════════════════════════════════════════════════════════
// BUILDER 4 — COMPETITORS REPORT
// ═════════════════════════════════════════════════════════════
export async function downloadCompetitorsReport({ venue, selectedComps = [] }) {
  if (!venue || !selectedComps.length) return;
  const groups = [
    { type: 'direct',   title: 'Direct Competitors' },
    { type: 'indirect', title: 'Indirect Competitors' },
    { type: 'custom',   title: 'Custom Competitors' },
  ];

  const children = [
    ...brandHeader('Competitor Analysis', venue.name),

    mixedP([
      new TextRun({ text: 'Total Competitors Analysed: ', bold: true }),
      new TextRun({ text: String(selectedComps.length), color: GOLD, bold: true }),
    ]),
    spacer(),
  ];

  for (const g of groups) {
    const list = selectedComps.filter(c => c.type === g.type);
    if (!list.length) continue;
    children.push(h1(`${g.title} (${list.length})`));
    list.forEach(c => {
      children.push(h3(c.name));
      children.push(mixedP([
        new TextRun({ text: 'Cuisine: ', bold: true }), new TextRun({ text: c.cuisine || 'N/A' }),
        new TextRun({ text: '   Location: ', bold: true }), new TextRun({ text: c.location || 'N/A' }),
        new TextRun({ text: '   Price: ', bold: true }), new TextRun({ text: c.price_range || c.priceRange || 'N/A' }),
      ]));
      const gRating = c.google_rating ?? c.googleRating;
      children.push(mixedP([
        new TextRun({ text: 'Google Rating: ', bold: true }),
        new TextRun({ text: gRating != null ? String(gRating) : 'N/A', color: GOLD, bold: true }),
      ]));
      if (c.scraped && c.food_score) {
        children.push(mixedP([
          new TextRun({ text: 'Scored: ', bold: true }),
          new TextRun({ text: `Food ${Number(c.food_score).toFixed(1)}`, color: colorForScore(c.food_score), bold: true }),
          new TextRun({ text: '  Service ' }),
          new TextRun({ text: Number(c.service_score).toFixed(1), color: colorForScore(c.service_score), bold: true }),
          new TextRun({ text: '  Atmosphere ' }),
          new TextRun({ text: Number(c.atmosphere_score).toFixed(1), color: colorForScore(c.atmosphere_score), bold: true }),
          new TextRun({ text: '  Overall ' }),
          new TextRun({ text: Number(c.overall_score || 0).toFixed(1), color: colorForScore(c.overall_score), bold: true }),
        ]));
      }
      if (c.reason) children.push(p(`Why: ${c.reason}`, { italics: true }));
      if (c.top_positives?.length) {
        children.push(mixedP([
          new TextRun({ text: 'Strengths: ', bold: true, color: POS }),
          new TextRun({ text: c.top_positives.join(', ') }),
        ]));
      }
      if (c.top_negatives?.length) {
        children.push(mixedP([
          new TextRun({ text: 'Weaknesses: ', bold: true, color: NEG }),
          new TextRun({ text: c.top_negatives.join(', ') }),
        ]));
      }
      children.push(spacer());
    });
  }
  children.push(...footer());
  await save(buildDoc(children), `${venue.id}-competitors-${today()}`);
}

// ═════════════════════════════════════════════════════════════
// BUILDER 5 — BENCHMARKS REPORT
// ═════════════════════════════════════════════════════════════
export async function downloadBenchmarksReport({ venue, rd, selectedComps = [] }) {
  if (!venue || !rd || !selectedComps.length) return;
  const scored = selectedComps.filter(c => c.scraped && (c.food_score || c.overall_score));
  const own = { name: venue.name, food: rd.food_score, service: rd.service_score, atm: rd.atmosphere_score, overall: rd.overall_score };
  const all = [own, ...scored.map(c => ({
    name: c.name,
    food: c.food_score || 0,
    service: c.service_score || 0,
    atm: c.atmosphere_score || 0,
    overall: c.overall_score || 0,
  }))].sort((a, b) => (b.overall || 0) - (a.overall || 0));

  const ownIdx = all.findIndex(x => x.name === venue.name);

  // Ranking table
  const rankRows = [
    [{ text: '#' }, { text: 'Venue' }, { text: 'Overall' }, { text: 'Food' }, { text: 'Service' }, { text: 'Atmosphere' }],
    ...all.map((x, i) => {
      const isOwn = x.name === venue.name;
      const bg = isOwn ? GOLD : undefined;
      const color = isOwn ? NAVY : undefined;
      const fmt = n => (Number(n) || 0).toFixed(1);
      return [
        { text: String(i + 1), bold: isOwn, bg, color },
        { text: x.name + (isOwn ? '  ◀ YOU' : ''), bold: isOwn, bg, color },
        { text: fmt(x.overall), bold: true, bg, color: isOwn ? NAVY : colorForScore(x.overall) },
        { text: fmt(x.food),    bg, color: isOwn ? NAVY : colorForScore(x.food) },
        { text: fmt(x.service), bg, color: isOwn ? NAVY : colorForScore(x.service) },
        { text: fmt(x.atm),     bg, color: isOwn ? NAVY : colorForScore(x.atm) },
      ];
    }),
  ];

  // Gap analysis
  const gapRows = [[{ text: 'Dimension' }, { text: 'Your Rank' }, { text: 'Leader' }, { text: 'Gap' }]];
  for (const key of ['overall', 'food', 'service', 'atm']) {
    const sorted = [...all].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const rank = sorted.findIndex(x => x.name === venue.name) + 1;
    const leader = sorted[0];
    const gap = rank > 1 ? (leader[key] - own[key]).toFixed(1) : '🏆 Leader';
    const label = key === 'atm' ? 'Atmosphere' : key.charAt(0).toUpperCase() + key.slice(1);
    gapRows.push([
      { text: label, bold: true },
      { text: `#${rank} of ${all.length}` },
      { text: leader.name },
      { text: rank > 1 ? `-${gap} behind` : gap, color: rank > 1 ? NEG : POS, bold: true },
    ]);
  }

  const children = [
    ...brandHeader('Competitive Benchmarking', venue.name),

    mixedP([
      new TextRun({ text: 'Your Position: ', bold: true }),
      new TextRun({ text: `#${ownIdx + 1} of ${all.length}`, color: GOLD, bold: true, size: 28 }),
    ]),
    spacer(),

    h1('Full Ranking Table'),
    simpleTable(rankRows),
    spacer(),

    h1('Gap Analysis'),
    simpleTable(gapRows),
    ...footer(),
  ];
  await save(buildDoc(children), `${venue.id}-benchmarks-${today()}`);
}

// ═════════════════════════════════════════════════════════════
// BUILDER 6 — STRATEGY REPORT
// ═════════════════════════════════════════════════════════════
export async function downloadStrategyReport({ venue, strat }) {
  if (!venue || !strat) return;
  const children = [
    ...brandHeader('Strategic Recommendations', venue.name),

    h1('Executive Summary'),
    p(strat.executive_summary || '', { italics: true }),
    spacer(),
  ];

  const recSections = [
    { title: 'Food Recommendations',       color: NAVY, data: strat.food_recommendations },
    { title: 'Service Recommendations',    color: NAVY, data: strat.service_recommendations },
    { title: 'Atmosphere Recommendations', color: NAVY, data: strat.atmosphere_recommendations },
  ];

  for (const sec of recSections) {
    if (!sec.data?.length) continue;
    children.push(h1(sec.title, sec.color));
    sec.data.forEach(r => {
      const priorityColor = r.priority === 'high' ? NEG : r.priority === 'medium' ? WARN : MUT;
      children.push(mixedP([
        new TextRun({ text: `[${(r.priority || '').toUpperCase()}] `, bold: true, color: priorityColor }),
        new TextRun({ text: r.recommendation || '' }),
      ]));
      if (r.based_on) children.push(p(`Based on: ${r.based_on}`, { italics: true, color: MUT, size: 20 }));
    });
    children.push(spacer());
  }

  if (strat.quick_wins?.length) {
    children.push(h1('Quick Wins — 30 Days', POS));
    strat.quick_wins.forEach(q => {
      children.push(bullet(q.action, { bold: true }));
      children.push(p(`Timeline: ${q.timeline || '30 days'}  ·  Expected Impact: ${q.expected_impact || ''}`, { italics: true, color: MUT, size: 20 }));
    });
    children.push(spacer());
  }

  if (strat.strategic_initiatives?.length) {
    children.push(h1('Strategic Initiatives — 3-6 Months'));
    strat.strategic_initiatives.forEach(s => {
      children.push(bullet(s.action, { bold: true }));
      children.push(p(`Timeline: ${s.timeline || '3-6 months'}  ·  Expected Impact: ${s.expected_impact || ''}`, { italics: true, color: MUT, size: 20 }));
    });
    children.push(spacer());
  }

  if (strat.competitive_threats?.length) {
    children.push(h1('Competitive Threats', NEG));
    strat.competitive_threats.forEach(t => {
      children.push(mixedP([
        new TextRun({ text: `${t.competitor}: `, bold: true, color: NEG }),
        new TextRun({ text: t.threat || '' }),
      ]));
      if (t.response) children.push(p(`Response: ${t.response}`, { italics: true, color: MUT, size: 20 }));
    });
    children.push(spacer());
  }

  if (strat.team_action_items?.length) {
    children.push(h1('Team Action Items', GOLD));
    strat.team_action_items.forEach(t => {
      children.push(mixedP([
        new TextRun({ text: `[${(t.type || '').toUpperCase()}] `, bold: true, color: GOLD }),
        new TextRun({ text: t.detail || '' }),
      ]));
    });
  }

  children.push(...footer());
  await save(buildDoc(children), `${venue.id}-strategy-${today()}`);
}

// ═════════════════════════════════════════════════════════════
// BUILDER 7 — FULL REPORT (everything combined)
// ═════════════════════════════════════════════════════════════
export async function downloadFullReport({ venue, rd, selectedComps = [], strat }) {
  if (!venue) return;

  const children = [...brandHeader('Full Intelligence Report', venue.name)];

  // ── Section 1: Scores ──
  if (rd) {
    children.push(h1('1. Review Scores'));
    children.push(simpleTable([
      [{ text: 'Dimension' }, { text: 'Score' }, { text: 'Rating' }],
      [{ text: 'Overall' },    { text: `${rd.overall_score}/5.0`,    color: colorForScore(rd.overall_score),    bold: true }, { text: labelForScore(rd.overall_score) }],
      [{ text: 'Food' },       { text: `${rd.food_score}/5.0`,       color: colorForScore(rd.food_score),       bold: true }, { text: labelForScore(rd.food_score) }],
      [{ text: 'Service' },    { text: `${rd.service_score}/5.0`,    color: colorForScore(rd.service_score),    bold: true }, { text: labelForScore(rd.service_score) }],
      [{ text: 'Atmosphere' }, { text: `${rd.atmosphere_score}/5.0`, color: colorForScore(rd.atmosphere_score), bold: true }, { text: labelForScore(rd.atmosphere_score) }],
    ]));
    children.push(spacer());
    children.push(mixedP([
      new TextRun({ text: 'Reviews: ', bold: true }), new TextRun({ text: String(rd.reviewCount || rd.reviews?.length || 0) }),
      new TextRun({ text: '   Google: ', bold: true }), new TextRun({ text: String(rd.googleRating ?? 'N/A') }),
      rd.tripAdvisorRating != null ? new TextRun({ text: '   TripAdvisor: ', bold: true }) : new TextRun({ text: '' }),
      rd.tripAdvisorRating != null ? new TextRun({ text: String(rd.tripAdvisorRating) }) : new TextRun({ text: '' }),
    ]));
    if (rd.top_positives?.length) {
      children.push(h3('Strengths', POS));
      rd.top_positives.forEach(s => children.push(bullet(s)));
    }
    if (rd.top_negatives?.length) {
      children.push(h3('Weaknesses', NEG));
      rd.top_negatives.forEach(s => children.push(bullet(s)));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Section 2: Competitors ──
  if (selectedComps.length) {
    children.push(h1(`2. Competitors (${selectedComps.length})`));
    selectedComps.forEach(c => {
      children.push(mixedP([
        new TextRun({ text: c.name, bold: true, size: 24, color: NAVY }),
        new TextRun({ text: `  ·  ${c.type || 'direct'}`, italics: true, color: MUT }),
        new TextRun({ text: `  ·  ${c.cuisine || 'N/A'}`, color: MUT }),
      ]));
      if (c.scraped && c.food_score) {
        children.push(mixedP([
          new TextRun({ text: 'F ', color: MUT }), new TextRun({ text: Number(c.food_score).toFixed(1), bold: true, color: colorForScore(c.food_score) }),
          new TextRun({ text: '  S ', color: MUT }), new TextRun({ text: Number(c.service_score).toFixed(1), bold: true, color: colorForScore(c.service_score) }),
          new TextRun({ text: '  A ', color: MUT }), new TextRun({ text: Number(c.atmosphere_score).toFixed(1), bold: true, color: colorForScore(c.atmosphere_score) }),
          new TextRun({ text: '  Overall ', color: MUT }), new TextRun({ text: Number(c.overall_score || 0).toFixed(1), bold: true, color: colorForScore(c.overall_score) }),
        ]));
      }
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Section 3: Strategy ──
  if (strat) {
    children.push(h1('3. Strategy'));
    if (strat.executive_summary) children.push(p(strat.executive_summary, { italics: true }));
    children.push(spacer());
    if (strat.quick_wins?.length) {
      children.push(h2('Quick Wins (30 Days)', POS));
      strat.quick_wins.forEach(q => children.push(bullet(`${q.action} — ${q.timeline || '30 days'}`)));
    }
    if (strat.strategic_initiatives?.length) {
      children.push(h2('Strategic Initiatives (3-6 Months)'));
      strat.strategic_initiatives.forEach(s => children.push(bullet(`${s.action} — ${s.timeline || '3-6 months'}`)));
    }
    if (strat.competitive_threats?.length) {
      children.push(h2('Competitive Threats', NEG));
      strat.competitive_threats.forEach(t => children.push(bullet(`${t.competitor}: ${t.threat}`)));
    }
  }

  children.push(...footer());
  await save(buildDoc(children), `${venue.id}-full-report-${today()}`);
}
