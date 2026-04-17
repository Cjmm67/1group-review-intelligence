'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Cell } from 'recharts';
import {
  downloadDashboardReport,
  downloadReviewsReport,
  downloadTeamReport,
  downloadCompetitorsReport,
  downloadBenchmarksReport,
  downloadStrategyReport,
  downloadFullReport,
} from '@/lib/docx-report';

const C = { navy:'#1a1a2e', gold:'#c9a84c', goldL:'#d4b86a', white:'#fff', bg:'#f8f9fa', bdr:'#e9ecef', mut:'#6c757d', pos:'#28a745', warn:'#fd7e14', neg:'#dc3545', text:'#212529' };
const scCol = s => s>=4.5?C.pos:s>=4?'#7cb342':s>=3.5?C.warn:s>=3?'#ff9800':s>=2?C.neg:'#b71c1c';
const scLbl = s => s>=4.5?'Excellent':s>=4?'Very Good':s>=3.5?'Good':s>=3?'Average':'Below Avg';

// Main venues with sub-brands (alphabetical)
const VENUE_GROUPS = [
  { id:'1-alfaro', name:'1-Alfaro', location:'Singapore', type:'Multi-Concept Venue',
    subs:[
      {id:'la-lune',name:'La Lune',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining','celebrations']},
      {id:'la-torre',name:'La Torre',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining','celebrations']},
      {id:'1-alfaro-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'1-arden', name:'1-Arden', location:'Level 51, CapitaSpring', type:'Sky Dining Destination',
    subs:[
      {id:'1-arden-bar',name:'1-Arden Bar',type:'Cocktail Bar',cuisine:'Craft cocktails',price:'$$$',occ:['after-work','date night']},
      {id:'kaarla',name:'Kaarla',type:'Modern Australian',cuisine:'Live-fire cooking',price:'$$$$',occ:['business dinner','celebrations']},
      {id:'oumi',name:'Oumi',type:'Japanese Omakase',cuisine:'Contemporary Japanese',price:'$$$$',occ:['omakase','special occasion']},
      {id:'sol-luna',name:'Sol & Luna',type:'Mediterranean',cuisine:'Mediterranean sharing',price:'$$$',occ:['group dining','date night']},
      {id:'1-arden-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'1-altitude-coast', name:'1-Altitude Coast', location:'One Fullerton', type:'Coastal Dining Destination',
    subs:[
      {id:'1-altitude-coast-bar',name:'1-Altitude Coast Bar',type:'Bar',cuisine:'Cocktails & beverages',price:'$$$',occ:['drinks','sunset']},
      {id:'sol-ora',name:'Sol & Ora',type:'Restaurant',cuisine:'Coastal dining',price:'$$$',occ:['casual dining','brunch']},
      {id:'1-altitude-coast-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'1-atico', name:'1-Atico', location:'Singapore', type:'Rooftop Destination',
    subs:[
      {id:'1-atico-lounge',name:'1-Atico Lounge',type:'Lounge',cuisine:'Lounge & bar',price:'$$$',occ:['drinks','celebrations']},
      {id:'fire',name:'Fire',type:'Restaurant',cuisine:'Grill & flames',price:'$$$$',occ:['dining','celebrations']},
      {id:'flnt',name:'Flnt',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining']},
      {id:'1-atico-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'1-flowerhill', name:'1-Flowerhill', location:'Singapore', type:'Garden Dining Destination',
    subs:[
      {id:'camille',name:'Camille',type:'French Bistro',cuisine:'Modern French',price:'$$$',occ:['brunch','business lunch']},
      {id:'wildseed-cafe-flowerhill',name:'Wildseed Cafe',type:'Cafe',cuisine:'Cafe & pastries',price:'$$',occ:['coffee','casual']},
      {id:'wildseed-bar-grill',name:'Wildseed Bar & Grill',type:'Bar & Grill',cuisine:'Grill & drinks',price:'$$$',occ:['group dining','drinks']},
      {id:'1-flowerhill-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'monti', name:'Monti', location:'Fullerton Pavilion', type:'Italian Restaurant',
    subs:[
      {id:'monti-restaurant',name:'Monti',type:'Italian Restaurant',cuisine:'Italian',price:'$$$$',occ:['business lunch','romantic dinner','celebrations']},
      {id:'monti-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'the-alkaff-mansion', name:'The Alkaff Mansion', location:'Telok Blangah', type:'Heritage Estate',
    subs:[
      {id:'1918',name:'1918',type:'Bar & Lounge',cuisine:'Cocktails',price:'$$$',occ:['drinks','events']},
      {id:'una',name:'Una',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining','celebrations']},
      {id:'wildseed-cafe-alkaff',name:'Wildseed Cafe',type:'Cafe',cuisine:'Cafe & pastries',price:'$$',occ:['coffee','casual']},
      {id:'alkaff-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'the-garage', name:'The Garage', location:'Singapore', type:'Dining Venue',
    subs:[
      {id:'il-giardino',name:'iL Giardino',type:'Italian Restaurant',cuisine:'Italian',price:'$$$',occ:['dining','celebrations']},
      {id:'wildseed-cafe-garage',name:'Wildseed Cafe',type:'Cafe',cuisine:'Cafe & pastries',price:'$$',occ:['coffee','casual']},
      {id:'garage-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'the-river-house', name:'The River House', location:'Clarke Quay', type:'Heritage Dining Destination',
    subs:[
      {id:'mimi',name:'Mimi',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining']},
      {id:'yin',name:'Yin',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining']},
      {id:'yang',name:'Yang',type:'Restaurant',cuisine:'TBC',price:'$$$',occ:['dining']},
      {id:'zorba',name:'Zorba',type:'Restaurant',cuisine:'Greek-Mediterranean',price:'$$$',occ:['group dining','celebrations']},
      {id:'river-house-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
  { id:'the-summer-house', name:'The Summer House', location:'Singapore Botanic Gardens', type:'Garden Dining Estate',
    subs:[
      {id:'botanico',name:'Botanico',type:'Restaurant',cuisine:'Mediterranean-European',price:'$$$$',occ:['romantic dinner','celebrations']},
      {id:'wildseed-bistro',name:'Wildseed Bistro',type:'Bistro',cuisine:'Bistro fare',price:'$$$',occ:['brunch','casual dining']},
      {id:'wildseed-cafe-summer',name:'Wildseed Cafe',type:'Cafe',cuisine:'Cafe & pastries',price:'$$',occ:['coffee','casual']},
      {id:'summer-house-weddings',name:'Weddings',type:'Wedding Venue',cuisine:'Wedding Events',price:'$$$$',occ:['wedding','solemnisation','banquet'],isWedding:true},
    ]},
];

// Flat list of all analysable venues (sub-brands)
const VENUES = VENUE_GROUPS.flatMap(g => g.subs.map(s => ({...s, parent:g.id, parentName:g.name, location:s.location||g.location})));


function Gauge({ score, label, size = 80 }) {
  if (!score || score <= 0) return (<div style={{ textAlign:'center', width:size }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke={C.bdr} strokeWidth="6"/><text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fontSize={size*0.22} fontWeight="700" fill={C.mut}>—</text></svg>{label && <div style={{ fontSize:11, color:C.mut, marginTop:3 }}>{label}</div>}</div>);
  const r = size/2-8, circ = 2*Math.PI*r, off = circ-(score/5)*circ, col = scCol(score);
  return (<div style={{ textAlign:'center', width:size }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.bdr} strokeWidth="6"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s' }}/><text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fontSize={size*0.26} fontWeight="800" fill={col} style={{ transform:'rotate(90deg)', transformOrigin:'center' }}>{score.toFixed(1)}</text></svg>{label && <div style={{ fontSize:11, color:C.mut, marginTop:3 }}>{label}</div>}</div>);
}

export default function Home() {
  const [venue, setVenue] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [googleUrl, setGoogleUrl] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [competitors, setCompetitors] = useState({});  // { venueId: [{...comp, selected, scraped, scores}] }
  const [strategy, setStrategy] = useState({});
  const [addCompName, setAddCompName] = useState('');
  const [compProgress, setCompProgress] = useState(null); // { current, total, name }
  const [expandedGroups, setExpandedGroups] = useState({}); // { venueGroupId: true/false }
  const [weeklyHistory, setWeeklyHistory] = useState({}); // { venueId: [snapshot, ...] }
  const [competitorLock, setCompetitorLock] = useState({}); // { venueId: { locked, competitors } }

  // ── ISO week helpers ──
  const getISOWeek = (d = new Date()) => {
    const date = new Date(d); date.setHours(0,0,0,0);
    date.setDate(date.getDate()+3-(date.getDay()+6)%7);
    const w1 = new Date(date.getFullYear(),0,4);
    const wn = 1+Math.round(((date-w1)/86400000-3+(w1.getDay()+6)%7)/7);
    return `${date.getFullYear()}-W${String(wn).padStart(2,'0')}`;
  };
  const getMonthId = (d = new Date()) => new Date(d).toISOString().slice(0,7);
  const today = () => new Date().toISOString().split('T')[0];

  // ── localStorage persistence ──
  const LS_WEEKS = 'ri-weekly-history';
  const LS_COMP_LOCK = 'ri-competitor-lock';

  useEffect(() => {
    try {
      const wh = JSON.parse(localStorage.getItem(LS_WEEKS) || '{}');
      setWeeklyHistory(wh);
      const cl = JSON.parse(localStorage.getItem(LS_COMP_LOCK) || '{}');
      setCompetitorLock(cl);
    } catch {}
  }, []);

  const persistWeeks = (newHistory) => {
    setWeeklyHistory(newHistory);
    try { localStorage.setItem(LS_WEEKS, JSON.stringify(newHistory)); } catch {}
  };
  const persistCompLock = (newLock) => {
    setCompetitorLock(newLock);
    try { localStorage.setItem(LS_COMP_LOCK, JSON.stringify(newLock)); } catch {}
  };

  // ── Save This Week's Analysis ──
  const saveWeeklySnapshot = () => {
    if (!venue || !rd) return;
    const weekId = getISOWeek();
    const monthId = getMonthId();
    const snapshot = {
      weekId, monthId,
      savedAt: today(),
      venueId: venue,
      scores: {
        overall: rd.overall_score,
        food: rd.food_score,
        service: rd.service_score,
        atmosphere: rd.atmosphere_score,
        coordination: rd.coordination_score || null,
      },
      reviewCount: rd.reviewCount || rd.reviews?.length || 0,
      sources: rd.sources || {},
      topPositives: rd.top_positives || [],
      topNegatives: rd.top_negatives || [],
      teamMentions: (rd.team_mentions || []).map(m => ({ name:m.name, role:m.role, count:m.mention_count, sentiment:m.avg_sentiment })),
      competitorScores: selectedComps.filter(c => c.scraped).map(c => ({
        name: c.name, overall: c.overall_score, food: c.food_score,
        service: c.service_score, atmosphere: c.atmosphere_score,
      })),
      strategySnapshot: strat ? { executive_summary: strat.executive_summary } : null,
    };
    const history = { ...weeklyHistory };
    const venueWeeks = [...(history[venue] || [])];
    // Replace if same week exists, otherwise append
    const existIdx = venueWeeks.findIndex(w => w.weekId === weekId);
    if (existIdx >= 0) venueWeeks[existIdx] = snapshot;
    else venueWeeks.push(snapshot);
    // Keep max 52 weeks (1 year)
    while (venueWeeks.length > 52) venueWeeks.shift();
    history[venue] = venueWeeks;
    persistWeeks(history);

    // Also lock competitors if not already locked
    if (selectedComps.length > 0 && !competitorLock[venue]?.locked) {
      lockCompetitors();
    }
  };

  // ── Competitor Lock ──
  const lockCompetitors = () => {
    if (!venue || !selectedComps.length) return;
    persistCompLock({ ...competitorLock, [venue]: { locked: true, lockedAt: today(), competitors: selectedComps } });
  };
  const unlockCompetitors = () => {
    if (!venue) return;
    persistCompLock({ ...competitorLock, [venue]: { ...competitorLock[venue], locked: false } });
  };
  const isCompLocked = venue && competitorLock[venue]?.locked;

  // Load locked competitors when venue changes
  useEffect(() => {
    if (venue && competitorLock[venue]?.locked && competitorLock[venue]?.competitors?.length) {
      // Only load locked competitors if we don't already have competitors for this venue
      if (!competitors[venue]?.length) {
        setCompetitors(prev => ({ ...prev, [venue]: competitorLock[venue].competitors }));
      }
    }
  }, [venue]);

  // ── Trend Calculations ──
  const venueWeeks = venue ? (weeklyHistory[venue] || []) : [];
  const lastWeek = venueWeeks.length > 0 ? venueWeeks[venueWeeks.length - 1] : null;
  const prevWeek = venueWeeks.length > 1 ? venueWeeks[venueWeeks.length - 2] : null;

  const getTrend = (dimension) => {
    if (!lastWeek || !prevWeek) return null;
    const curr = lastWeek.scores?.[dimension] || 0;
    const prev = prevWeek.scores?.[dimension] || 0;
    if (!curr || !prev) return null;
    return +(curr - prev).toFixed(1);
  };

  // ── Monthly Aggregation ──
  const getMonthlyData = () => {
    if (!venueWeeks.length) return [];
    const months = {};
    venueWeeks.forEach(w => {
      const mid = w.monthId;
      if (!months[mid]) months[mid] = { monthId: mid, weeks: [], scores: { overall:[], food:[], service:[], atmosphere:[] } };
      months[mid].weeks.push(w);
      if (w.scores?.overall) months[mid].scores.overall.push(w.scores.overall);
      if (w.scores?.food) months[mid].scores.food.push(w.scores.food);
      if (w.scores?.service) months[mid].scores.service.push(w.scores.service);
      if (w.scores?.atmosphere) months[mid].scores.atmosphere.push(w.scores.atmosphere);
    });
    const avg = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : 0;
    return Object.values(months).map(m => ({
      monthId: m.monthId,
      weekCount: m.weeks.length,
      totalReviews: m.weeks.reduce((s,w) => s + (w.reviewCount||0), 0),
      scores: { overall: avg(m.scores.overall), food: avg(m.scores.food), service: avg(m.scores.service), atmosphere: avg(m.scores.atmosphere) },
    })).sort((a,b) => a.monthId.localeCompare(b.monthId));
  };

  const v = venue ? VENUES.find(x => x.id === venue) : null;
  const isWedding = v?.isWedding === true;
  const rd = venue ? data[venue] : null;
  const comps = venue ? (competitors[venue] || []) : [];
  const selectedComps = comps.filter(c => c.selected !== false);
  const strat = venue ? strategy[venue] : null;
  const hasData = rd && rd.overall_score > 0;

  const btn = (variant = 'gold') => ({ padding:'10px 18px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, display:'inline-flex', alignItems:'center', gap:7, transition:'all 0.2s', ...(variant==='gold'?{background:C.gold,color:C.navy}:variant==='navy'?{background:C.navy,color:C.white}:variant==='green'?{background:C.pos,color:C.white}:variant==='red'?{background:C.neg,color:C.white}:{background:'transparent',color:C.gold,border:`1.5px solid ${C.gold}`}) });
  const card = { background:C.white, borderRadius:10, border:`1px solid ${C.bdr}`, padding:18, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' };
  const inp = { padding:'9px 12px', borderRadius:8, border:`1.5px solid ${C.bdr}`, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' };
  const badge = c => ({ display:'inline-block', padding:'3px 9px', borderRadius:12, fontSize:10, fontWeight:700, color:C.white, background:c });

  // ── Extract Reviews ──
  const extractReviews = async () => {
    if (!googleUrl.trim() || !v) { setError('Paste a Google Maps URL first.'); return; }
    setLoading('reviews'); setError(null);
    try {
      const endpoint = isWedding ? '/api/wedding-reviews' : '/api/reviews';
      const payload = isWedding
        ? { query: googleUrl, venueName: v.parentName, parentVenueName: v.parentName, venueType: v.type, googleLimit: 40, tripAdvisorLimit: 20, dateFrom, dateTo }
        : { query: googleUrl, venueName: v.name, venueType: v.type, reviewsLimit: 30, dateFrom, dateTo };
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      setData(prev => ({...prev,[venue]:result}));
      setTab('reviews');
    } catch(e) { setError(e.message); }
    setLoading(null);
  };

  // ── Discover Competitors ──
  const findCompetitors = async () => {
    if (!v) return;
    setLoading('competitors'); setError(null);
    try {
      const endpoint = isWedding ? '/api/wedding-competitors' : '/api/competitors';
      const payload = isWedding
        ? { venueName: v.parentName || v.name, venueType: v.type, location: v.location, priceTier: v.price }
        : { venueName: v.name, venueType: v.type, cuisine: v.cuisine, location: v.location, priceTier: v.price, occasions: v.occ };
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      const withSelection = (result.competitors||[]).map(c => ({...c, selected:true, scraped:false, food_score:null, service_score:null, atmosphere_score:null, overall_score:c.google_rating||null}));
      setCompetitors(prev => ({...prev,[venue]:withSelection}));
    } catch(e) { setError(e.message); }
    setLoading(null);
  };

  // ── Toggle competitor selection ──
  const toggleComp = (name) => {
    setCompetitors(prev => ({...prev,[venue]:(prev[venue]||[]).map(c => c.name===name?{...c,selected:!c.selected}:c)}));
  };

  // ── Remove competitor ──
  const removeComp = (name) => {
    setCompetitors(prev => ({...prev,[venue]:(prev[venue]||[]).filter(c => c.name!==name)}));
  };

  // ── Add manual competitor ──
  const addCompetitor = () => {
    if (!addCompName.trim() || !venue) return;
    const input = addCompName.trim();
    const isUrl = /^https?:\/\//i.test(input) || /maps\.app\.goo\.gl/i.test(input) || /google\.com\/maps/i.test(input);
    const newComp = {
      name: isUrl ? '(loading from URL...)' : input,
      mapsUrl: isUrl ? input : null,
      type: 'custom',
      reason: 'Manually added',
      cuisine: 'Unknown',
      location: 'Singapore',
      price_range: '$$$',
      google_rating: null,
      key_strengths: [],
      key_weaknesses: [],
      selected: true,
      scraped: false,
      food_score: null,
      service_score: null,
      atmosphere_score: null,
      overall_score: null,
    };
    setCompetitors(prev => ({...prev,[venue]:[...(prev[venue]||[]),newComp]}));
    setAddCompName('');
  };

  // ── Extract reviews for all selected competitors ──
  // Uses the same date range and review limit as the main venue scrape
  // so the comparison is fair (apples-to-apples).
  const extractCompetitorReviews = async () => {
    const toScrape = selectedComps.filter(c => !c.scraped);
    if (!toScrape.length) { setError('All selected competitors already scored.'); return; }
    setLoading('comp-reviews'); setError(null);
    let updated = [...comps];

    for (let i = 0; i < toScrape.length; i++) {
      const comp = toScrape[i];
      setCompProgress({ current:i+1, total:toScrape.length, name:comp.mapsUrl ? '📍 ' + (comp.name || comp.mapsUrl) : comp.name });

      try {
        // Use Google Maps URL if available (much more accurate than name search)
        const query = comp.mapsUrl || `${comp.name} Singapore restaurant`;
        const res = await fetch('/api/competitor-reviews', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            query,
            competitorName: comp.name !== '(loading from URL...)' ? comp.name : null,
            competitorType: comp.cuisine,
            reviewsLimit: 30,  // match main venue default for fair comparison
            dateFrom,          // same date range as main venue
            dateTo,
          }),
        });
        const result = await res.json();

        if (!result.error) {
          updated = updated.map(c => c.name===comp.name || (comp.mapsUrl && c.mapsUrl===comp.mapsUrl) ? {
            ...c,
            name: result.name || c.name,  // Outscraper resolves the real venue name
            scraped: true,
            food_score: result.food_score,
            service_score: result.service_score,
            atmosphere_score: result.atmosphere_score,
            overall_score: result.overall_score || result.googleRating,
            googleRating: result.googleRating || c.google_rating,
            reviewCount: result.reviewCount,
            top_positives: result.top_positives,
            top_negatives: result.top_negatives,
          } : c);
        }
      } catch(e) { console.error(`Failed: ${comp.name}`, e); }

      // Rate limit delay between calls
      if (i < toScrape.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    setCompetitors(prev => ({...prev,[venue]:updated}));
    setCompProgress(null);
    setLoading(null);
  };

  // ── Generate Strategy ──
  const genStrategy = async () => {
    if (!v || !rd) return;
    setLoading('strategy'); setError(null);
    try {
      const res = await fetch('/api/score', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({venueName:v.name,scores:{food:rd.food_score,service:rd.service_score,atmosphere:rd.atmosphere_score},positives:rd.top_positives,negatives:rd.top_negatives,competitors:selectedComps}) });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      setStrategy(prev => ({...prev,[venue]:result}));
    } catch(e) { setError(e.message); }
    setLoading(null);
  };

  // ── Add More Strategies (appends to existing, no duplicates) ──
  const addMoreStrategies = async () => {
    if (!v || !rd || !strat) return;
    setLoading('strategy'); setError(null);
    try {
      const existing = [
        ...(strat.food_recommendations||[]).map(r=>r.recommendation),
        ...(strat.service_recommendations||[]).map(r=>r.recommendation),
        ...(strat.atmosphere_recommendations||[]).map(r=>r.recommendation),
        ...(strat.quick_wins||[]).map(q=>q.action),
        ...(strat.strategic_initiatives||[]).map(s=>s.action),
      ].join(' | ');
      const res = await fetch('/api/score', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        venueName:v.name,
        scores:{food:rd.food_score,service:rd.service_score,atmosphere:rd.atmosphere_score},
        positives:rd.top_positives, negatives:rd.top_negatives, competitors:selectedComps,
        additionalContext: `You have ALREADY recommended these strategies: "${existing}". Generate NEW, DIFFERENT recommendations that do NOT duplicate any of the above. Focus on areas not yet covered. Be creative and specific.`,
      }) });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      // Merge new into existing — append, don't replace
      setStrategy(prev => {
        const old = prev[venue] || {};
        return {...prev, [venue]: {
          ...old,
          executive_summary: old.executive_summary || result.executive_summary,
          food_recommendations: [...(old.food_recommendations||[]), ...(result.food_recommendations||[])],
          service_recommendations: [...(old.service_recommendations||[]), ...(result.service_recommendations||[])],
          atmosphere_recommendations: [...(old.atmosphere_recommendations||[]), ...(result.atmosphere_recommendations||[])],
          quick_wins: [...(old.quick_wins||[]), ...(result.quick_wins||[])],
          strategic_initiatives: [...(old.strategic_initiatives||[]), ...(result.strategic_initiatives||[])],
          competitive_threats: [...(old.competitive_threats||[]), ...(result.competitive_threats||[])],
          team_action_items: [...(old.team_action_items||[]), ...(result.team_action_items||[])],
        }};
      });
    } catch(e) { setError(e.message); }
    setLoading(null);
  };

  // ── Strategy editing helpers ──
  const updateStratField = (field, value) => {
    setStrategy(prev => ({...prev, [venue]: {...(prev[venue]||{}), [field]: value}}));
  };
  const updateStratItem = (field, index, key, value) => {
    setStrategy(prev => {
      const old = {...(prev[venue]||{})};
      const arr = [...(old[field]||[])];
      arr[index] = {...arr[index], [key]: value};
      return {...prev, [venue]: {...old, [field]: arr}};
    });
  };
  const removeStratItem = (field, index) => {
    setStrategy(prev => {
      const old = {...(prev[venue]||{})};
      const arr = [...(old[field]||[])];
      arr.splice(index, 1);
      return {...prev, [venue]: {...old, [field]: arr}};
    });
  };
  const addStratItem = (field, template) => {
    setStrategy(prev => {
      const old = {...(prev[venue]||{})};
      return {...prev, [venue]: {...old, [field]: [...(old[field]||[]), template]}};
    });
  };

  // ── Download helpers (.docx exports) ──
  // Each tab delegates to a dedicated Word-doc builder in lib/docx-report.js
  // so the files are editable, properly formatted, and ready to share.
  const exportDashboard   = () => downloadDashboardReport({ venue: v, rd });
  const exportReviews     = () => downloadReviewsReport({ venue: v, rd });
  const exportTeam        = () => downloadTeamReport({ venue: v, rd });
  const exportCompetitors = () => downloadCompetitorsReport({ venue: v, selectedComps });
  const exportBenchmarks  = () => downloadBenchmarksReport({ venue: v, rd, selectedComps });
  const exportStrategy    = () => downloadStrategyReport({ venue: v, strat });
  const exportFullReport  = () => downloadFullReport({ venue: v, rd, selectedComps, strat });

  // ── Reset current venue analysis ──
  const resetVenue = () => {
    if (!venue) return;
    if (!window.confirm(`Reset all data for ${v?.name}? This will clear reviews, competitors, and strategy.`)) return;
    setData(prev => { const n = {...prev}; delete n[venue]; return n; });
    setCompetitors(prev => { const n = {...prev}; delete n[venue]; return n; });
    setStrategy(prev => { const n = {...prev}; delete n[venue]; return n; });
    setGoogleUrl('');
    setTab('dashboard');
    setError(null);
  };

  // ── Reset everything ──
  const resetAll = () => {
    if (!window.confirm('Reset ALL venue data? This clears reviews, competitors, and strategy for every venue.')) return;
    setData({}); setCompetitors({}); setStrategy({}); setGoogleUrl(''); setVenue(null); setTab('dashboard'); setError(null);
  };

  // ── Save/Export bar component ──
  const ActionBar = ({ onSave, saveLabel = '💾 Save Report', showReset = true }) => (
    <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:12, flexWrap:'wrap' }}>
      {onSave && <button onClick={onSave} style={{...btn('outline'), padding:'7px 14px', fontSize:12}}>
        {saveLabel}
      </button>}
      <button onClick={exportFullReport} style={{...btn('outline'), padding:'7px 14px', fontSize:12}}>
        📋 Full Report (.docx)
      </button>
      {showReset && <button onClick={resetVenue} style={{...btn('red'), padding:'7px 14px', fontSize:12}}>
        🔄 Reset Venue
      </button>}
    </div>
  );

  const Spinner = ({text}) => (<div style={{textAlign:'center',padding:40}}><div style={{width:40,height:40,border:`4px solid ${C.bdr}`,borderTop:`4px solid ${C.gold}`,borderRadius:'50%',margin:'0 auto 12px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:13,color:C.mut}}>{text}</div></div>);
  const Error = () => error ? (<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:12,marginBottom:12,fontSize:12,color:'#991b1b',display:'flex',alignItems:'center',gap:8}}>⚠️ {error}<button onClick={()=>setError(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#991b1b',fontSize:14}}>✕</button></div>) : null;

  // ═══ VENUE GRID ═══
  if (!venue) return (
    <div style={{fontFamily:'Georgia,serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>
      <div style={{background:`linear-gradient(135deg,${C.navy},#16213e)`,color:C.white,padding:'20px 24px'}}>
        <div style={{fontSize:22,fontWeight:700}}>1-Group Review Intelligence</div>
        <div style={{fontSize:12,color:C.goldL,letterSpacing:1,textTransform:'uppercase'}}>Outscraper + Claude AI · Real Google Reviews</div>
      </div>
      <div style={{padding:'20px 24px',maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <h2 style={{fontSize:20,fontWeight:700,color:C.navy,margin:0}}>1-Group Venues</h2>
          {Object.keys(data).length > 0 && <button onClick={resetAll} style={{...btn('outline'),padding:'7px 14px',fontSize:12,color:C.neg,borderColor:C.neg}}>🔄 Reset All</button>}
        </div>
        <p style={{fontSize:13,color:C.mut,marginBottom:20}}>Select a main venue to expand its sub-brands. Click a sub-brand to analyse.</p>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {VENUE_GROUPS.map(g => {
            const isOpen = expandedGroups[g.id];
            // Count how many sub-brands have data
            const analysedCount = g.subs.filter(s => data[s.id] && data[s.id].overall_score > 0).length;
            // Best score among sub-brands
            const scores = g.subs.map(s => data[s.id]?.overall_score).filter(s => s > 0);
            const bestScore = scores.length ? Math.max(...scores) : 0;

            return (
              <div key={g.id} style={{background:C.white,borderRadius:10,border:`1px solid ${C.bdr}`,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                {/* Main venue header — click to expand */}
                <div
                  onClick={() => setExpandedGroups(prev => ({...prev, [g.id]: !prev[g.id]}))}
                  style={{padding:'16px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',borderLeft:`4px solid ${bestScore>0?scCol(bestScore):C.gold}`,transition:'background 0.15s',background:isOpen?'#fdf8e8':'transparent'}}
                >
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <span style={{fontSize:18,transition:'transform 0.2s',transform:isOpen?'rotate(90deg)':'rotate(0deg)',display:'inline-block'}}>▸</span>
                    <div>
                      <div style={{fontSize:17,fontWeight:700,color:C.navy}}>{g.name}</div>
                      <div style={{fontSize:12,color:C.mut}}>
                        {g.type} · 📍 {g.location} · <span style={{color:C.gold,fontWeight:600}}>{g.subs.length} sub-brand{g.subs.length!==1?'s':''}</span>
                        {analysedCount > 0 && <span style={{marginLeft:8,color:C.pos,fontWeight:600}}>· {analysedCount} analysed</span>}
                      </div>
                    </div>
                  </div>
                  {bestScore > 0 && <Gauge score={bestScore} size={42}/>}
                </div>

                {/* Sub-brands dropdown */}
                {isOpen && (
                  <div style={{borderTop:`1px solid ${C.bdr}`,padding:'8px 12px 12px 48px',background:'#fafafa'}}>
                    <div style={{fontSize:11,color:C.mut,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>Sub-Brands</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:8}}>
                      {g.subs.map(s => {
                        const d = data[s.id];
                        const has = d && d.overall_score > 0;
                        return (
                          <div key={s.id}
                            onClick={() => { setVenue(s.id); setTab('dashboard'); }}
                            style={{padding:'12px 14px',borderRadius:8,border:`1px solid ${has?scCol(d.overall_score)+'40':C.bdr}`,background:C.white,cursor:'pointer',transition:'all 0.15s',borderLeft:`3px solid ${has?scCol(d.overall_score):C.bdr}`}}
                            onMouseOver={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-1px)'}}
                            onMouseOut={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}
                          >
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <div>
                                <div style={{fontSize:14,fontWeight:700,color:C.navy}}>{s.name}</div>
                                <div style={{fontSize:11,color:C.mut}}>{s.type}{s.cuisine!=='TBC'?` · ${s.cuisine}`:''} · {s.price}</div>
                              </div>
                              {has && <Gauge score={d.overall_score} size={36}/>}
                            </div>
                            {has
                              ? <div style={{fontSize:11,color:C.pos,fontWeight:600,marginTop:4}}>⭐ {d.reviewCount||d.reviews?.length} reviews · F:{d.food_score} S:{d.service_score} A:{d.atmosphere_score}</div>
                              : <div style={{fontSize:11,color:C.warn,fontWeight:500,marginTop:4}}>→ Click to analyse</div>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const tabs = [{id:'dashboard',label:'📊 Dashboard'},{id:'reviews',label:'⭐ Reviews'},{id:'team',label:'👥 Team'},{id:'competitors',label:'🎯 Competitors'},{id:'benchmarks',label:'🏆 Benchmarks'},{id:'trends',label:'📈 Trends'},{id:'strategy',label:'⚡ Strategy'}];

  return (
    <div style={{fontFamily:'Georgia,serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${C.navy},#16213e)`,color:C.white,padding:'14px 22px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{cursor:'pointer'}} onClick={()=>setVenue(null)}><div style={{fontSize:19,fontWeight:700}}>1-Group Review Intelligence</div><div style={{fontSize:11,color:C.goldL,letterSpacing:1,textTransform:'uppercase'}}>Outscraper + Claude AI</div></div>
        <span style={{fontSize:13,color:C.goldL,fontWeight:600}}>{v?.parentName} › {v?.name}</span>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:C.white,borderBottom:`2px solid ${C.bdr}`,overflowX:'auto',padding:'0 8px'}}>
        <button style={{padding:'10px 14px',cursor:'pointer',fontSize:13,fontWeight:700,color:C.navy,background:'none',border:'none',borderBottom:'3px solid transparent'}} onClick={()=>setVenue(null)}>← Venues</button>
        <div style={{width:1,height:18,background:C.bdr,alignSelf:'center'}}/>
        {tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 14px',cursor:'pointer',fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?C.gold:C.mut,borderBottom:tab===t.id?`3px solid ${C.gold}`:'3px solid transparent',background:'none',border:'none',whiteSpace:'nowrap'}}>{t.label}</button>))}
      </div>

      <div style={{padding:'18px 22px',maxWidth:1200,margin:'0 auto'}}>
        <Error/>

        {/* ═══ DASHBOARD ═══ */}
        {tab==='dashboard' && (<div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,padding:'10px 14px',background:C.white,borderRadius:8,border:`1px solid ${C.bdr}`}}>
            <button style={btn('navy')} onClick={()=>setVenue(null)}>← All Venues</button>
            <div style={{width:1,height:20,background:C.bdr}}/>
            <div><div style={{fontSize:11,color:C.gold,fontWeight:600,marginBottom:1}}>{v?.parentName}</div><div style={{fontSize:16,fontWeight:700,color:C.navy}}>{v?.name}</div><div style={{fontSize:11,color:C.mut}}>{v?.type} · {v?.location} · {v?.price}</div></div>
          </div>
          {loading==='reviews' && <Spinner text="Extracting reviews from Google via Outscraper + scoring with AI..."/>}
          {loading!=='reviews' && (<div style={{...card,borderLeft:`4px solid ${C.gold}`}}>
            <div style={{fontSize:16,fontWeight:700,color:C.navy,marginBottom:6}}>Extract Google Reviews</div>
            <div style={{fontSize:12,color:C.mut,marginBottom:14,lineHeight:1.7}}>Paste your venue's <strong>Google Maps URL</strong> below. Outscraper extracts real reviews, Claude AI scores them.</div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:C.mut,fontWeight:600,display:'block',marginBottom:4}}>Google Maps URL</label><input type="url" value={googleUrl} onChange={e=>setGoogleUrl(e.target.value)} placeholder="e.g. https://maps.app.goo.gl/... or 'Sol & Luna CapitaSpring Singapore'" style={inp}/></div>
            <div style={{display:'flex',gap:14,marginBottom:14,flexWrap:'wrap'}}>
              <div><label style={{fontSize:11,color:C.mut,fontWeight:600,display:'block',marginBottom:4}}>From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...inp,width:155}}/></div>
              <div style={{paddingTop:22,color:C.mut}}>→</div>
              <div><label style={{fontSize:11,color:C.mut,fontWeight:600,display:'block',marginBottom:4}}>To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...inp,width:155}}/></div>
            </div>
            <button onClick={extractReviews} disabled={loading||!googleUrl.trim()} style={{...btn('gold'),padding:'14px 32px',fontSize:15,width:'100%',justifyContent:'center',opacity:(!googleUrl.trim()||loading)?0.5:1}}>
              {isWedding ? '💒 Extract Wedding Reviews (Google + TripAdvisor + Lemon8 + Bridely)' : '🔍 Extract & Score Reviews'}
            </button>
          </div>)}
          {hasData && loading!=='reviews' && (<div style={{marginTop:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
              <div style={{display:'flex',gap:8}}>
                <button onClick={saveWeeklySnapshot} style={{...btn('navy'),padding:'7px 14px',fontSize:12}}>📅 Save This Week ({getISOWeek()})</button>
                <button onClick={exportDashboard} style={{...btn('outline'),padding:'7px 14px',fontSize:12}}>💾 Dashboard (.docx)</button>
                <button onClick={exportFullReport} style={{...btn('outline'),padding:'7px 14px',fontSize:12}}>📋 Full Report (.docx)</button>
              </div>
              <button onClick={resetVenue} style={{...btn('red'),padding:'7px 14px',fontSize:12}}>🔄 Reset Venue</button>
            </div>
            {lastWeek && <div style={{...card,padding:10,background:'#f0fdf4',borderLeft:`4px solid ${C.pos}`,fontSize:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontWeight:700,color:C.pos}}>✓ Last saved: {lastWeek.weekId}</span>
              <span style={{color:C.mut}}>({lastWeek.savedAt})</span>
              <span style={{color:C.mut}}>·</span>
              <span style={{color:C.mut}}>{venueWeeks.length} week{venueWeeks.length!==1?'s':''} of history</span>
              <button onClick={()=>setTab('trends')} style={{background:'none',border:'none',color:C.gold,fontWeight:700,cursor:'pointer',fontSize:12}}>View Trends →</button>
            </div>}
            <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
              {[{key:'overall',label:'Overall',score:rd.overall_score,sz:88},{key:'food',label:'Food',score:rd.food_score,sz:72},{key:'service',label:'Service',score:rd.service_score,sz:72},{key:'atmosphere',label:'Atmosphere',score:rd.atmosphere_score,sz:72}].map(g=>{
                const trend = getTrend(g.key);
                return <div key={g.key} style={{...card,flex:'1 1 170px',textAlign:'center'}}>
                  <Gauge score={g.score} label={g.label} size={g.sz}/>
                  {g.key==='overall' && <div style={{fontSize:11,color:C.mut,marginTop:3}}>{scLbl(g.score)}</div>}
                  {trend !== null && <div style={{fontSize:11,fontWeight:700,marginTop:4,color:trend>0?C.pos:trend<0?C.neg:C.mut}}>
                    {trend>0?'▲':trend<0?'▼':'─'} {trend>0?'+':''}{trend} vs prev week
                  </div>}
                </div>;
              })}
              {isWedding && rd.coordination_score > 0 && <div style={{...card,flex:'1 1 170px',textAlign:'center',borderTop:`3px solid ${C.gold}`}}><Gauge score={rd.coordination_score} label="Coordination" size={72}/></div>}
            </div>
            {rd.sources && <div style={{...card,padding:12,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',fontSize:12}}>
              <span style={{fontWeight:700,color:C.navy}}>Sources:</span>
              {rd.sources.google > 0 && <span style={badge(C.gold)}>Google {rd.sources.google}</span>}
              {rd.sources.tripadvisor > 0 && <span style={badge('#00aa6c')}>TripAdvisor {rd.sources.tripadvisor}</span>}
              {rd.sources.lemon8 > 0 && <span style={badge('#ff6b6b')}>Lemon8 {rd.sources.lemon8}</span>}
              {rd.sources.bridely > 0 && <span style={badge('#e91e9c')}>Bridely {rd.sources.bridely}</span>}
              {isWedding && rd.totalScanned > 0 && <span style={{fontSize:11,color:C.mut,marginLeft:4}}>(filtered {rd.weddingRelevantCount || rd.reviewCount} wedding reviews from {rd.totalScanned} total scanned)</span>}
            </div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={card}><div style={{fontSize:13,fontWeight:700,color:C.pos,marginBottom:4}}>✦ Strengths</div>{(rd.top_positives||[]).map((p,i)=><div key={i} style={{fontSize:12,padding:'3px 0',borderBottom:`1px solid ${C.bdr}`}}>{p}</div>)}</div>
              <div style={card}><div style={{fontSize:13,fontWeight:700,color:C.neg,marginBottom:4}}>⚠ Weaknesses</div>{(rd.top_negatives||[]).map((n,i)=><div key={i} style={{fontSize:12,padding:'3px 0',borderBottom:`1px solid ${C.bdr}`}}>{n}</div>)}</div>
            </div>
          </div>)}
        </div>)}

        {/* ═══ REVIEWS ═══ */}
        {tab==='reviews' && hasData && (<div>
          <ActionBar onSave={exportReviews} saveLabel="💾 Save Reviews (.docx)"/>
          <h2 style={{fontSize:19,fontWeight:700,color:C.navy,marginBottom:10}}>{v?.parentName ? `${v.parentName} — ` : ''}{v?.name} — {rd.reviews?.length} Reviews</h2>
          <div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
            <Gauge score={rd.food_score} label="Food" size={64}/>
            <Gauge score={rd.service_score} label="Service" size={64}/>
            <Gauge score={rd.atmosphere_score} label="Atmosphere" size={64}/>
            {isWedding && rd.coordination_score > 0 && <Gauge score={rd.coordination_score} label="Coordination" size={64}/>}
          </div>
          {(rd.reviews||[]).map((r,i)=>(<div key={i} style={{...card,animation:`fadeIn 0.3s ease ${i*0.03}s both`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={badge(r.source==='tripadvisor'?'#00aa6c':r.source==='lemon8'?'#ff6b6b':r.source==='bridely'?'#e91e9c':C.gold)}>{r.sourceLabel||r.source||'Google'}</span>
                <span style={{...badge(r.sentiment==='positive'?C.pos:r.sentiment==='negative'?C.neg:C.warn),background:(r.sentiment==='positive'?C.pos:r.sentiment==='negative'?C.neg:C.warn)+'20',color:r.sentiment==='positive'?C.pos:r.sentiment==='negative'?C.neg:C.warn}}>{r.sentiment}</span>
                {r.rating&&<span style={{fontSize:12,color:C.gold,fontWeight:700}}>{'★'.repeat(Math.round(r.rating))}</span>}
                {r.weddingType && <span style={{fontSize:10,background:'#f3e5f5',color:'#7b1fa2',padding:'2px 7px',borderRadius:10}}>{r.weddingType}</span>}
              </div>
              <span style={{fontSize:11,color:C.mut}}>{r.date}{r.author&&` · ${r.author}`}</span>
            </div>
            {r.title && <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:3}}>{r.title}</div>}
            <p style={{fontSize:12,lineHeight:1.6,margin:'0 0 5px'}}>{r.summary||r.text?.slice(0,150)}</p>
            <div style={{display:'flex',gap:12,fontSize:11,flexWrap:'wrap'}}>
              <span style={{color:scCol(r.food_score)}}>Food:{r.food_score}/5</span>
              <span style={{color:scCol(r.service_score)}}>Service:{r.service_score}/5</span>
              <span style={{color:scCol(r.atmosphere_score)}}>Atm:{r.atmosphere_score}/5</span>
              {r.coordination_score > 0 && <span style={{color:scCol(r.coordination_score)}}>Coord:{r.coordination_score}/5</span>}
            </div>
            {r.key_themes?.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:5}}>{r.key_themes.map((t,j)=><span key={j} style={{fontSize:10,background:C.bg,padding:'2px 7px',borderRadius:10,color:C.mut}}>{t}</span>)}</div>}
          </div>))}
        </div>)}
        {tab==='reviews'&&!hasData&&(
          rd ? (
            // Extraction attempted but returned zero reviews — show diagnostic info
            <div style={{maxWidth:640,margin:'40px auto'}}>
              <div style={{...card,borderLeft:`4px solid ${C.warn}`,padding:18}}>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:8}}>⚠️ No reviews returned</div>
                <div style={{fontSize:13,color:C.mut,marginBottom:12}}>{rd.message || 'Outscraper returned 0 places for this query.'}</div>
                {rd.attemptedQuery && (<div style={{fontSize:12,marginBottom:8}}>
                  <span style={{color:C.mut}}>Query sent: </span>
                  <span style={{fontFamily:'monospace',background:C.bg,padding:'2px 6px',borderRadius:4,wordBreak:'break-all'}}>{rd.attemptedQuery}</span>
                </div>)}
                {rd.sources && (<div style={{fontSize:12,color:C.mut,marginBottom:8}}>
                  Sources: Google {rd.sources.google ?? 0} · TripAdvisor {rd.sources.tripadvisor ?? 0}
                </div>)}
                {rd.sourceErrors?.google && (<div style={{fontSize:11,color:C.neg,marginTop:6,fontFamily:'monospace',wordBreak:'break-all'}}>Google error: {rd.sourceErrors.google}</div>)}
                {rd.sourceErrors?.tripadvisor && (<div style={{fontSize:11,color:C.neg,marginTop:6,fontFamily:'monospace',wordBreak:'break-all'}}>TripAdvisor error: {rd.sourceErrors.tripadvisor}</div>)}
                <div style={{marginTop:14,padding:12,background:C.bg,borderRadius:6,fontSize:12,color:C.navy,lineHeight:1.5}}>
                  <div style={{fontWeight:700,marginBottom:4}}>💡 Try one of these</div>
                  <div>• Open the venue on Google Maps, click <b>Share → Copy link</b>, paste the resulting URL</div>
                  <div>• Or type the venue name + location (e.g. <i>"Una Alkaff Mansion Singapore"</i>)</div>
                  <div>• For ambiguous names (common words), always prefer the direct Maps URL</div>
                </div>
                <button onClick={()=>setTab('dashboard')} style={{...btn('gold'),marginTop:14,padding:'8px 16px',fontSize:12}}>← Back to Dashboard to retry</button>
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:50,color:C.mut}}>⭐<div style={{fontSize:15,fontWeight:700,color:C.navy,marginTop:8}}>No reviews yet</div></div>
          )
        )}

        {/* ═══ TEAM ═══ */}
        {tab==='team' && (<div>{(rd?.team_mentions||[]).length>0 && <ActionBar onSave={exportTeam} saveLabel="💾 Save Team (.docx)"/>}<h2 style={{fontSize:19,fontWeight:700,color:C.navy,marginBottom:10}}>{v?.name} — Team</h2>{(rd?.team_mentions||[]).length>0?rd.team_mentions.map((m,i)=>(<div key={i} style={{...card,borderLeft:`4px solid ${m.avg_sentiment==='positive'?C.gold:C.bdr}`,display:'flex',gap:10,padding:14}}><div>✨</div><div><div style={{fontWeight:700,fontSize:14}}>{m.name}</div><div style={{fontSize:11,color:C.mut}}>{m.role} · {m.mention_count} mentions · {m.avg_sentiment}</div><div style={{fontSize:12,color:C.mut,fontStyle:'italic',marginTop:4}}>{m.sample_context}</div></div></div>)):<div style={{textAlign:'center',padding:50,color:C.mut}}>👥<div style={{fontSize:15,fontWeight:700,color:C.navy,marginTop:8}}>No team members found</div></div>}</div>)}

        {/* ═══ COMPETITORS ═══ */}
        {tab==='competitors' && (<div>
          {comps.length>0 && <ActionBar onSave={exportCompetitors} saveLabel="💾 Save Competitors (.docx)"/>}
          {isCompLocked && <div style={{...card,padding:10,background:'#eff6ff',borderLeft:`4px solid #3b82f6`,fontSize:12,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>🔒 <strong>Competitor set locked</strong> — same {(competitorLock[venue]?.competitors||[]).length} competitors used each week for consistent tracking. <button onClick={()=>setTab('trends')} style={{background:'none',border:'none',color:C.gold,fontWeight:700,cursor:'pointer',fontSize:12}}>View in Trends →</button></span>
            <button onClick={unlockCompetitors} style={{...btn('outline'),padding:'4px 10px',fontSize:11}}>🔓 Unlock</button>
          </div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h2 style={{fontSize:19,fontWeight:700,color:C.navy,margin:0}}>{v?.name} — Competitors</h2>
            <div style={{display:'flex',gap:8}}>
              {!comps.length && !isCompLocked && <button style={btn('gold')} onClick={findCompetitors} disabled={loading==='competitors'}>{loading==='competitors'?'🔄 Finding...':(isWedding?'💒 Discover Wedding Competitors':'🔍 Discover Competitors')}</button>}
              {selectedComps.length>0 && selectedComps.some(c=>!c.scraped) && <button style={btn('green')} onClick={extractCompetitorReviews} disabled={loading==='comp-reviews'}>📊 Extract Reviews ({selectedComps.filter(c=>!c.scraped).length})</button>}
            </div>
          </div>

          {loading==='competitors' && <Spinner text="AI is searching for competitors..."/>}
          {loading==='comp-reviews' && compProgress && (<div style={{...card,borderLeft:`4px solid ${C.gold}`,textAlign:'center',padding:24}}>
            <div style={{width:40,height:40,border:`4px solid ${C.bdr}`,borderTop:`4px solid ${C.gold}`,borderRadius:'50%',margin:'0 auto 10px',animation:'spin 1s linear infinite'}}/>
            <div style={{fontSize:14,fontWeight:700,color:C.navy}}>Extracting reviews: {compProgress.current} of {compProgress.total}</div>
            <div style={{fontSize:13,color:C.gold,marginTop:4}}>{compProgress.name}</div>
            <div style={{background:C.bdr,borderRadius:4,height:6,marginTop:12,overflow:'hidden'}}><div style={{background:C.gold,height:'100%',borderRadius:4,width:`${(compProgress.current/compProgress.total)*100}%`,transition:'width 0.5s'}}/></div>
            <div style={{fontSize:11,color:C.mut,marginTop:6}}>~{(compProgress.total-compProgress.current)*30}s remaining. Each competitor takes ~30s.</div>
          </div>)}

          {/* Manual add */}
          {comps.length>0 && (<div style={{...card,display:'flex',gap:8,alignItems:'center',padding:12}}>
            <input value={addCompName} onChange={e=>setAddCompName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCompetitor()}} placeholder="Add competitor by Google Maps URL..." style={{...inp,flex:1}}/>
            <button onClick={addCompetitor} disabled={!addCompName.trim()} style={{...btn('outline'),padding:'8px 16px',opacity:addCompName.trim()?1:0.4}}>+ Add</button>
          </div>)}

          {/* Competitor cards with checkboxes */}
          {comps.length>0 && (<div>
            <div style={{fontSize:12,color:C.mut,marginBottom:10}}>✓ = selected for benchmarking. Click checkbox to include/exclude. Click ✕ to remove.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {['direct','indirect','custom'].map(type => {
                const group = comps.filter(c => c.type === type);
                if (!group.length) return null;
                return (<div key={type}>
                  <div style={{fontSize:14,fontWeight:700,color:type==='direct'?C.navy:type==='custom'?C.gold:C.mut,marginBottom:8,textTransform:'capitalize'}}>{type} ({group.length})</div>
                  {group.map((c,i) => (<div key={i} style={{...card,borderLeft:`4px solid ${c.scraped?scCol(c.overall_score||0):C.bdr}`,opacity:c.selected===false?0.5:1,position:'relative',padding:14}}>
                    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <input type="checkbox" checked={c.selected!==false} onChange={()=>toggleComp(c.name)} style={{marginTop:3,cursor:'pointer',accentColor:C.gold}}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <div style={{fontWeight:700,fontSize:13}}>{c.mapsUrl && '📍 '}{c.name}</div>
                          <button onClick={()=>removeComp(c.name)} style={{background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:12}}>✕</button>
                        </div>
                        <div style={{fontSize:11,color:C.mut}}>{c.cuisine} · {c.location} {c.price_range&&`· ${c.price_range}`}</div>
                        {c.google_rating && <div style={{fontSize:11,marginTop:2}}>Google: ★ {c.google_rating}</div>}
                        {c.scraped && c.food_score ? (
                          <div style={{display:'flex',gap:8,marginTop:6,fontSize:11,flexWrap:'wrap',alignItems:'center'}}>
                            <span style={{color:scCol(c.food_score),fontWeight:600}}>F:{c.food_score.toFixed(1)}</span>
                            <span style={{color:scCol(c.service_score),fontWeight:600}}>S:{c.service_score.toFixed(1)}</span>
                            <span style={{color:scCol(c.atmosphere_score),fontWeight:600}}>A:{c.atmosphere_score.toFixed(1)}</span>
                            <span style={badge(C.pos)}>scored</span>
                            {c.reviewCount > 0 && <span style={{color:C.mut,fontSize:10}}>({c.reviewCount} reviews)</span>}
                          </div>
                        ) : c.scraped ? <span style={badge(C.warn)}>no reviews found</span> : <span style={{fontSize:10,color:C.mut}}>Not yet scored</span>}
                        <p style={{fontSize:11,color:C.mut,marginTop:4,marginBottom:0}}>{c.reason}</p>
                      </div>
                    </div>
                  </div>))}
                </div>);
              })}
            </div>
          </div>)}

          {!comps.length && !loading && <div style={{textAlign:'center',padding:50,color:C.mut}}>🎯<div style={{fontSize:15,fontWeight:700,color:C.navy,marginTop:8}}>No competitors yet</div><div style={{fontSize:13}}>Click Discover to find 10 competitors via AI.</div><button style={{...btn('gold'),marginTop:14}} onClick={findCompetitors}>Discover Competitors</button></div>}
        </div>)}

        {/* ═══ BENCHMARKS ═══ */}
        {tab==='benchmarks' && (<div>
          {hasData && selectedComps.some(c=>c.scraped) && <ActionBar onSave={exportBenchmarks} saveLabel="💾 Save Benchmarks (.docx)"/>}
          <h2 style={{fontSize:19,fontWeight:700,color:C.navy,marginBottom:12}}>{v?.name} — Competitive Benchmarks</h2>
          {hasData && selectedComps.some(c=>c.scraped) ? (() => {
            const scored = selectedComps.filter(c => c.scraped && (c.food_score || c.overall_score));
            const own = { name:v.name, food:rd.food_score, service:rd.service_score, atm:rd.atmosphere_score, overall:rd.overall_score, isOwn:true };
            const all = [own, ...scored.map(c => ({ name:c.name, food:c.food_score||0, service:c.service_score||0, atm:c.atmosphere_score||0, overall:c.overall_score||c.googleRating||0, isOwn:false }))].sort((a,b) => (b.overall||0)-(a.overall||0));

            // Dimension rankings
            const rankBy = (key) => [...all].sort((a,b) => (b[key]||0)-(a[key]||0));
            const ownRank = (key) => { const r=rankBy(key); return r.findIndex(x=>x.isOwn)+1; };

            // Radar data
            const radarData = ['Food','Service','Atmosphere'].map(dim => {
              const key = dim==='Food'?'food':dim==='Service'?'service':'atm';
              const compAvg = scored.length ? scored.reduce((sum,c) => sum+(c[key==='food'?'food_score':key==='service'?'service_score':'atmosphere_score']||0),0)/scored.length : 0;
              return { dimension:dim, [v.name]:own[key], 'Competitor Avg':Math.round(compAvg*10)/10 };
            });

            return (<div>
              {/* Rank summary cards */}
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                {[{label:'Overall',key:'overall',score:own.overall},{label:'Food',key:'food',score:own.food},{label:'Service',key:'service',score:own.service},{label:'Atmosphere',key:'atm',score:own.atm}].map(d => (
                  <div key={d.label} style={{...card,flex:'1 1 140px',textAlign:'center',padding:14}}>
                    <div style={{fontSize:11,color:C.mut,marginBottom:4}}>{d.label}</div>
                    <div style={{fontSize:24,fontWeight:800,color:scCol(d.score)}}>{d.score?.toFixed(1)||'—'}</div>
                    <div style={{fontSize:11,color:C.navy,fontWeight:600}}>Rank #{ownRank(d.key)} of {all.length}</div>
                    {ownRank(d.key)===1 && <div style={{fontSize:10,marginTop:2}}>🏆 Leader</div>}
                    {ownRank(d.key)>1 && <div style={{fontSize:10,color:C.neg,marginTop:2}}>Gap: {(rankBy(d.key)[0][d.key]-d.score).toFixed(1)} behind #{1}</div>}
                  </div>
                ))}
              </div>

              {/* Full ranking table */}
              <div style={{...card,overflowX:'auto'}}>
                <div style={{fontSize:14,fontWeight:700,color:C.navy,marginBottom:10}}>Full Rankings</div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{borderBottom:`2px solid ${C.navy}`,textAlign:'left'}}>
                    <th style={{padding:'8px 10px'}}>#</th><th style={{padding:'8px 10px'}}>Venue</th>
                    <th style={{padding:'8px 10px',textAlign:'center'}}>Overall</th><th style={{padding:'8px 10px',textAlign:'center'}}>Food</th>
                    <th style={{padding:'8px 10px',textAlign:'center'}}>Service</th><th style={{padding:'8px 10px',textAlign:'center'}}>Atmosphere</th>
                  </tr></thead>
                  <tbody>{all.map((x,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bdr}`,background:x.isOwn?'#fdf8e8':'transparent'}}>
                      <td style={{padding:'8px 10px',fontWeight:700,color:C.mut}}>{i+1}</td>
                      <td style={{padding:'8px 10px',fontWeight:x.isOwn?800:500,color:x.isOwn?C.gold:C.text}}>{x.name}{x.isOwn&&<span style={{fontSize:9,background:C.gold,color:C.white,padding:'1px 5px',borderRadius:3,marginLeft:6}}>YOU</span>}</td>
                      <td style={{textAlign:'center',padding:'8px 10px',fontWeight:700,color:scCol(x.overall)}}>{x.overall?.toFixed(1)||'—'}</td>
                      <td style={{textAlign:'center',padding:'8px 10px',color:scCol(x.food)}}>{x.food?.toFixed(1)||'—'}</td>
                      <td style={{textAlign:'center',padding:'8px 10px',color:scCol(x.service)}}>{x.service?.toFixed(1)||'—'}</td>
                      <td style={{textAlign:'center',padding:'8px 10px',color:scCol(x.atm)}}>{x.atm?.toFixed(1)||'—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              {/* Radar chart */}
              <div style={{...card,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,color:C.navy,marginBottom:10}}>Dimension Comparison</div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={C.bdr}/>
                    <PolarAngleAxis dataKey="dimension" tick={{fontSize:12}}/>
                    <PolarRadiusAxis domain={[0,5]} tick={{fontSize:10}}/>
                    <Radar name={v.name} dataKey={v.name} stroke={C.gold} fill={C.gold} fillOpacity={0.3} strokeWidth={2}/>
                    <Radar name="Competitor Avg" dataKey="Competitor Avg" stroke={C.mut} fill={C.mut} fillOpacity={0.15} strokeWidth={2}/>
                    <Legend/>
                    <Tooltip/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar charts per dimension */}
              {['Food','Service','Atmosphere'].map(dim => {
                const key = dim==='Food'?'food':dim==='Service'?'service':'atm';
                const sorted = [...all].sort((a,b)=>(b[key]||0)-(a[key]||0));
                return (<div key={dim} style={{...card,padding:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:8}}>{dim} Rankings</div>
                  <ResponsiveContainer width="100%" height={sorted.length*28+20}>
                    <BarChart data={sorted} layout="vertical" margin={{left:120}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/><XAxis type="number" domain={[0,5]} tick={{fontSize:10}}/><YAxis dataKey="name" type="category" tick={{fontSize:10}} width={120}/><Tooltip/>
                      <Bar dataKey={key} radius={[0,4,4,0]}>{sorted.map((x,i)=><Cell key={i} fill={x.isOwn?C.gold:scCol(x[key])}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>);
              })}
            </div>);
          })() : <div style={{textAlign:'center',padding:50,color:C.mut}}>🏆<div style={{fontSize:15,fontWeight:700,color:C.navy,marginTop:8}}>{!hasData?'Extract reviews first':'Extract competitor reviews first'}</div><div style={{fontSize:13,marginTop:4}}>Go to {!hasData?'Dashboard':'Competitors'} tab → {!hasData?'extract reviews':'click Extract Reviews'}.</div></div>}
        </div>)}

        {/* ═══ TRENDS — Weekly & Monthly Analysis ═══ */}
        {tab==='trends' && (<div>
          <h2 style={{fontSize:19,fontWeight:700,color:C.navy,marginBottom:14}}>{v?.name} — Weekly & Monthly Trends</h2>

          {/* Competitor Lock Status */}
          <div style={{...card,padding:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:20}}>{isCompLocked ? '🔒' : '🔓'}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.navy}}>Competitor Set: {isCompLocked ? 'Locked' : 'Unlocked'}</div>
                <div style={{fontSize:11,color:C.mut}}>
                  {isCompLocked
                    ? `Locked on ${competitorLock[venue]?.lockedAt} · ${(competitorLock[venue]?.competitors||[]).length} competitors · Same set used for all weekly analyses`
                    : 'Competitors will be locked after your first "Save This Week" to ensure consistent comparison'}
                </div>
              </div>
            </div>
            {isCompLocked
              ? <button onClick={unlockCompetitors} style={{...btn('outline'),padding:'6px 12px',fontSize:11}}>🔓 Unlock to Change</button>
              : selectedComps.length > 0 && <button onClick={lockCompetitors} style={{...btn('gold'),padding:'6px 12px',fontSize:11}}>🔒 Lock Current Set</button>
            }
          </div>

          {/* Weekly History */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:10}}>📅 Weekly History ({venueWeeks.length} weeks)</div>
            {venueWeeks.length === 0 && <div style={{...card,textAlign:'center',padding:30,color:C.mut}}>
              <div style={{fontSize:14,fontWeight:700,color:C.navy,marginBottom:6}}>No weeks saved yet</div>
              <div style={{fontSize:12}}>Go to Dashboard → extract reviews → click "📅 Save This Week" to start tracking trends.</div>
            </div>}
            {venueWeeks.length > 0 && <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:C.navy,color:C.white}}>
                  <th style={{padding:'8px 12px',textAlign:'left'}}>Week</th>
                  <th style={{padding:'8px 12px',textAlign:'left'}}>Saved</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Reviews</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Overall</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Food</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Service</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Atm</th>
                  <th style={{padding:'8px 12px',textAlign:'center'}}>Δ</th>
                </tr></thead>
                <tbody>{[...venueWeeks].reverse().map((w, i, arr) => {
                  const prev = arr[i+1]; // next in reversed array = previous chronologically
                  const delta = prev ? +(w.scores.overall - prev.scores.overall).toFixed(1) : null;
                  return <tr key={w.weekId} style={{borderBottom:`1px solid ${C.bdr}`,background:i===0?'#fffbeb':C.white}}>
                    <td style={{padding:'8px 12px',fontWeight:i===0?700:400}}>{w.weekId}{i===0?' (latest)':''}</td>
                    <td style={{padding:'8px 12px',color:C.mut}}>{w.savedAt}</td>
                    <td style={{padding:'8px 12px',textAlign:'center'}}>{w.reviewCount}</td>
                    <td style={{padding:'8px 12px',textAlign:'center',fontWeight:700,color:scCol(w.scores.overall)}}>{w.scores.overall?.toFixed(1)}</td>
                    <td style={{padding:'8px 12px',textAlign:'center',color:scCol(w.scores.food)}}>{w.scores.food?.toFixed(1)}</td>
                    <td style={{padding:'8px 12px',textAlign:'center',color:scCol(w.scores.service)}}>{w.scores.service?.toFixed(1)}</td>
                    <td style={{padding:'8px 12px',textAlign:'center',color:scCol(w.scores.atmosphere)}}>{w.scores.atmosphere?.toFixed(1)}</td>
                    <td style={{padding:'8px 12px',textAlign:'center',fontWeight:700,color:delta>0?C.pos:delta<0?C.neg:C.mut}}>{delta!==null?(delta>0?`▲+${delta}`:delta<0?`▼${delta}`:'─ 0.0'):'—'}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
          </div>

          {/* Monthly Aggregation */}
          {(() => {
            const monthly = getMonthlyData();
            if (!monthly.length) return null;
            return <div style={{marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:10}}>📊 Monthly Summary</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:C.gold,color:C.navy}}>
                    <th style={{padding:'8px 12px',textAlign:'left'}}>Month</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Weeks</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Total Reviews</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Avg Overall</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Avg Food</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Avg Service</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>Avg Atm</th>
                    <th style={{padding:'8px 12px',textAlign:'center'}}>MoM Δ</th>
                  </tr></thead>
                  <tbody>{monthly.map((m, i) => {
                    const prevMonth = monthly[i-1];
                    const momDelta = prevMonth ? +(m.scores.overall - prevMonth.scores.overall).toFixed(1) : null;
                    return <tr key={m.monthId} style={{borderBottom:`1px solid ${C.bdr}`,background:i===monthly.length-1?'#fffbeb':C.white}}>
                      <td style={{padding:'8px 12px',fontWeight:i===monthly.length-1?700:400}}>{m.monthId}{i===monthly.length-1?' (current)':''}</td>
                      <td style={{padding:'8px 12px',textAlign:'center'}}>{m.weekCount}</td>
                      <td style={{padding:'8px 12px',textAlign:'center'}}>{m.totalReviews}</td>
                      <td style={{padding:'8px 12px',textAlign:'center',fontWeight:700,color:scCol(m.scores.overall)}}>{m.scores.overall}</td>
                      <td style={{padding:'8px 12px',textAlign:'center',color:scCol(m.scores.food)}}>{m.scores.food}</td>
                      <td style={{padding:'8px 12px',textAlign:'center',color:scCol(m.scores.service)}}>{m.scores.service}</td>
                      <td style={{padding:'8px 12px',textAlign:'center',color:scCol(m.scores.atmosphere)}}>{m.scores.atmosphere}</td>
                      <td style={{padding:'8px 12px',textAlign:'center',fontWeight:700,color:momDelta>0?C.pos:momDelta<0?C.neg:C.mut}}>{momDelta!==null?(momDelta>0?`▲+${momDelta}`:momDelta<0?`▼${momDelta}`:'─ 0.0'):'—'}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </div>;
          })()}

          {/* Competitor Trend (if multiple weeks with competitor data) */}
          {(() => {
            const weeksWithComps = venueWeeks.filter(w => w.competitorScores?.length > 0);
            if (weeksWithComps.length < 2) return null;
            const latest = weeksWithComps[weeksWithComps.length - 1];
            const previous = weeksWithComps[weeksWithComps.length - 2];
            return <div>
              <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:10}}>🎯 Competitor Score Movement ({previous.weekId} → {latest.weekId})</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
                {latest.competitorScores.map((c, i) => {
                  const prev = previous.competitorScores.find(p => p.name === c.name);
                  const delta = prev ? +(c.overall - prev.overall).toFixed(1) : null;
                  return <div key={i} style={{...card,padding:12}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{c.name}</div>
                    <div style={{display:'flex',gap:12,fontSize:12}}>
                      <span style={{color:scCol(c.overall),fontWeight:700}}>{c.overall?.toFixed(1)}</span>
                      {delta !== null && <span style={{color:delta>0?C.pos:delta<0?C.neg:C.mut,fontWeight:600}}>
                        {delta>0?`▲+${delta}`:delta<0?`▼${delta}`:'─ 0.0'}
                      </span>}
                    </div>
                  </div>;
                })}
              </div>
            </div>;
          })()}

          {venueWeeks.length > 0 && <div style={{marginTop:16,textAlign:'right'}}>
            <button onClick={()=>{ if(window.confirm('Clear ALL weekly history for '+v?.name+'?')){ const h={...weeklyHistory}; delete h[venue]; persistWeeks(h); }}} style={{...btn('red'),padding:'6px 12px',fontSize:11}}>🗑 Clear History</button>
          </div>}
        </div>)}

        {/* ═══ STRATEGY ═══ */}
        {tab==='strategy' && (<div>
          {strat && <ActionBar onSave={exportStrategy} saveLabel="💾 Save Strategy (.docx)"/>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <h2 style={{fontSize:19,fontWeight:700,color:C.navy,margin:0}}>{v?.name} — Strategy</h2>
            <div style={{display:'flex',gap:8}}>
              {hasData && <button style={btn('gold')} onClick={genStrategy} disabled={loading==='strategy'}>{loading==='strategy'?'🔄 Generating...':(strat?'🔄 Regenerate':'⚡ Generate')}</button>}
              {strat && hasData && <button style={btn('navy')} onClick={addMoreStrategies} disabled={loading==='strategy'}>✨ Add More AI Strategies</button>}
            </div>
          </div>
          {loading==='strategy' && <Spinner text="Generating strategic recommendations..."/>}
          {strat && !loading && (<div>
            {/* Executive Summary — editable */}
            <div style={{...card,borderLeft:`4px solid ${C.gold}`}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:5}}>Executive Summary</div>
              <textarea value={strat.executive_summary||''} onChange={e=>updateStratField('executive_summary',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:6,padding:10,fontSize:13,lineHeight:1.7,minHeight:80,resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>

            {/* Recommendation sections — Food / Service / Atmosphere */}
            {[{t:'Food',field:'food_recommendations',c:C.pos},{t:'Service',field:'service_recommendations',c:C.gold},{t:'Atmosphere',field:'atmosphere_recommendations',c:C.warn}].map(sec=>(
              <div key={sec.t} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{fontSize:14,fontWeight:700,color:sec.c}}>{sec.t} ({(strat[sec.field]||[]).length})</div>
                  <button onClick={()=>addStratItem(sec.field,{recommendation:'New recommendation...',based_on:'',priority:'medium'})} style={{background:'none',border:`1px dashed ${sec.c}`,borderRadius:6,padding:'3px 10px',fontSize:11,color:sec.c,cursor:'pointer',fontWeight:600}}>+ Add</button>
                </div>
                {(strat[sec.field]||[]).map((r,i)=>(
                  <div key={i} style={{...card,padding:12,position:'relative'}}>
                    <button onClick={()=>removeStratItem(sec.field,i)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:14}} title="Remove">✕</button>
                    <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}>
                      <select value={r.priority||'medium'} onChange={e=>updateStratItem(sec.field,i,'priority',e.target.value)} style={{padding:'3px 6px',borderRadius:6,border:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:r.priority==='high'?C.neg:r.priority==='medium'?C.warn:C.pos,cursor:'pointer'}}>
                        <option value="high">HIGH</option><option value="medium">MEDIUM</option><option value="low">LOW</option>
                      </select>
                    </div>
                    <textarea value={r.recommendation||''} onChange={e=>updateStratItem(sec.field,i,'recommendation',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:6,fontSize:12,fontWeight:600,resize:'vertical',minHeight:36,fontFamily:'inherit',boxSizing:'border-box'}}/>
                    <input value={r.based_on||''} onChange={e=>updateStratItem(sec.field,i,'based_on',e.target.value)} placeholder="Based on..." style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.mut,marginTop:4,boxSizing:'border-box'}}/>
                  </div>
                ))}
              </div>
            ))}

            {/* Quick Wins */}
            <div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700}}>⚡ Quick Wins ({(strat.quick_wins||[]).length})</div>
                <button onClick={()=>addStratItem('quick_wins',{action:'New quick win...',timeline:'30 days',expected_impact:''})} style={{background:'none',border:`1px dashed ${C.gold}`,borderRadius:6,padding:'3px 10px',fontSize:11,color:C.gold,cursor:'pointer',fontWeight:600}}>+ Add</button>
              </div>
              {(strat.quick_wins||[]).map((q,i)=>(
                <div key={i} style={{...card,padding:12,position:'relative'}}>
                  <button onClick={()=>removeStratItem('quick_wins',i)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:14}} title="Remove">✕</button>
                  <textarea value={q.action||''} onChange={e=>updateStratItem('quick_wins',i,'action',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:6,fontSize:12,fontWeight:600,resize:'vertical',minHeight:36,fontFamily:'inherit',boxSizing:'border-box'}}/>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <input value={q.timeline||''} onChange={e=>updateStratItem('quick_wins',i,'timeline',e.target.value)} placeholder="Timeline" style={{flex:1,border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.mut,boxSizing:'border-box'}}/>
                    <input value={q.expected_impact||''} onChange={e=>updateStratItem('quick_wins',i,'expected_impact',e.target.value)} placeholder="Expected impact" style={{flex:2,border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.mut,boxSizing:'border-box'}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic Initiatives */}
            {strat.strategic_initiatives?.length>0&&<div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700}}>🎯 Strategic Initiatives ({strat.strategic_initiatives.length})</div>
                <button onClick={()=>addStratItem('strategic_initiatives',{action:'New initiative...',timeline:'3-6 months',expected_impact:''})} style={{background:'none',border:`1px dashed ${C.navy}`,borderRadius:6,padding:'3px 10px',fontSize:11,color:C.navy,cursor:'pointer',fontWeight:600}}>+ Add</button>
              </div>
              {strat.strategic_initiatives.map((s,i)=>(
                <div key={i} style={{...card,padding:12,position:'relative'}}>
                  <button onClick={()=>removeStratItem('strategic_initiatives',i)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:14}} title="Remove">✕</button>
                  <textarea value={s.action||''} onChange={e=>updateStratItem('strategic_initiatives',i,'action',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:6,fontSize:12,fontWeight:600,resize:'vertical',minHeight:36,fontFamily:'inherit',boxSizing:'border-box'}}/>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <input value={s.timeline||''} onChange={e=>updateStratItem('strategic_initiatives',i,'timeline',e.target.value)} placeholder="Timeline" style={{flex:1,border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.mut,boxSizing:'border-box'}}/>
                    <input value={s.expected_impact||''} onChange={e=>updateStratItem('strategic_initiatives',i,'expected_impact',e.target.value)} placeholder="Expected impact" style={{flex:2,border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.mut,boxSizing:'border-box'}}/>
                  </div>
                </div>
              ))}
            </div>}

            {/* Competitive Threats */}
            {strat.competitive_threats?.length>0&&<div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700}}>🛡 Competitive Threats ({strat.competitive_threats.length})</div>
                <button onClick={()=>addStratItem('competitive_threats',{competitor:'Competitor name',threat:'Threat description...',response:'Suggested response...'})} style={{background:'none',border:`1px dashed ${C.neg}`,borderRadius:6,padding:'3px 10px',fontSize:11,color:C.neg,cursor:'pointer',fontWeight:600}}>+ Add</button>
              </div>
              {strat.competitive_threats.map((t,i)=>(
                <div key={i} style={{...card,borderLeft:`4px solid ${C.neg}`,padding:12,position:'relative'}}>
                  <button onClick={()=>removeStratItem('competitive_threats',i)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:14}} title="Remove">✕</button>
                  <input value={t.competitor||''} onChange={e=>updateStratItem('competitive_threats',i,'competitor',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:12,fontWeight:700,marginBottom:4,boxSizing:'border-box'}}/>
                  <textarea value={t.threat||''} onChange={e=>updateStratItem('competitive_threats',i,'threat',e.target.value)} style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,resize:'vertical',minHeight:30,fontFamily:'inherit',boxSizing:'border-box'}}/>
                  <input value={t.response||''} onChange={e=>updateStratItem('competitive_threats',i,'response',e.target.value)} placeholder="↳ Response..." style={{width:'100%',border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:11,color:C.pos,fontWeight:600,marginTop:4,boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>}

            {/* Team Action Items */}
            {strat.team_action_items?.length>0&&<div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700}}>👥 Team Actions ({strat.team_action_items.length})</div>
                <button onClick={()=>addStratItem('team_action_items',{type:'training',detail:'New action item...'})} style={{background:'none',border:`1px dashed ${C.gold}`,borderRadius:6,padding:'3px 10px',fontSize:11,color:C.gold,cursor:'pointer',fontWeight:600}}>+ Add</button>
              </div>
              {strat.team_action_items.map((t,i)=>(
                <div key={i} style={{...card,padding:12,position:'relative',display:'flex',gap:8,alignItems:'flex-start'}}>
                  <button onClick={()=>removeStratItem('team_action_items',i)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:C.mut,fontSize:14}} title="Remove">✕</button>
                  <select value={t.type||'training'} onChange={e=>updateStratItem('team_action_items',i,'type',e.target.value)} style={{padding:'3px 6px',borderRadius:6,border:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.gold,cursor:'pointer'}}>
                    <option value="recognition">RECOGNITION</option><option value="coaching">COACHING</option><option value="training">TRAINING</option>
                  </select>
                  <textarea value={t.detail||''} onChange={e=>updateStratItem('team_action_items',i,'detail',e.target.value)} style={{flex:1,border:`1px solid ${C.bdr}`,borderRadius:4,padding:4,fontSize:12,resize:'vertical',minHeight:30,fontFamily:'inherit',boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>}
          </div>)}
          {!strat&&!loading&&<div style={{textAlign:'center',padding:50,color:C.mut}}>⚡<div style={{fontSize:15,fontWeight:700,color:C.navy,marginTop:8}}>{hasData?'Click Generate above':'Extract reviews first'}</div></div>}
        </div>)}
      </div>
    </div>
  );
}
