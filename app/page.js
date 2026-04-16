'use client';
import { useState, useEffect } from 'react';

const C = { navy:'#1a1a2e', gold:'#c9a84c', goldL:'#d4b86a', white:'#fff', bg:'#f8f9fa', bdr:'#e9ecef', mut:'#6c757d', pos:'#28a745', warn:'#fd7e14', neg:'#dc3545', text:'#212529' };
const scCol = s => s>=4.5?C.pos:s>=4?'#7cb342':s>=3.5?C.warn:s>=3?'#ff9800':s>=2?C.neg:'#b71c1c';
const scLbl = s => s>=4.5?'Excellent':s>=4?'Very Good':s>=3.5?'Good':s>=3?'Average':'Below Avg';

const VENUES = [
  {id:'1-altitude',name:'1-Altitude',type:'Rooftop Bar & Gallery',location:'Level 63, One Raffles Place',cuisine:'Craft cocktails',price:'$$$$',occ:['sunset drinks','celebrations']},
  {id:'1-altitude-coast',name:'1-Altitude Coast',type:'Coastal Dining',location:'One Fullerton',cuisine:'Seafood',price:'$$$',occ:['casual dining','brunch']},
  {id:'1-arden',name:'1-Arden',type:'Modern European',location:'Level 51, CapitaSpring',cuisine:'Contemporary European',price:'$$$$',occ:['business lunch','anniversary']},
  {id:'1-arden-bar',name:'1-Arden Bar',type:'Cocktail Bar',location:'Level 51, CapitaSpring',cuisine:'Craft cocktails',price:'$$$',occ:['after-work','date night']},
  {id:'oumi',name:'Oumi',type:'Japanese Omakase',location:'CapitaSpring',cuisine:'Contemporary Japanese',price:'$$$$',occ:['omakase','special occasion']},
  {id:'kaarla',name:'Kaarla',type:'Modern Australian',location:'CapitaSpring',cuisine:'Live-fire cooking',price:'$$$$',occ:['business dinner']},
  {id:'sol-luna',name:'Sol & Luna',type:'Mediterranean',location:'CapitaSpring',cuisine:'Mediterranean sharing',price:'$$$',occ:['group dining','date night']},
  {id:'camille',name:'Camille',type:'French Bistro',location:'Singapore',cuisine:'Modern French',price:'$$$',occ:['brunch','business lunch']},
  {id:'1-flowerhill',name:'1-Flowerhill',type:'Multi-Concept',location:'Singapore',cuisine:'Multi-concept',price:'$$$',occ:['date night','group dining']},
];

function Gauge({ score, label, size = 80 }) {
  if (!score || score <= 0) return (
    <div style={{ textAlign:'center', width:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke={C.bdr} strokeWidth="6"/>
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fontSize={size*0.22} fontWeight="700" fill={C.mut}>—</text>
      </svg>
      {label && <div style={{ fontSize:11, color:C.mut, marginTop:3 }}>{label}</div>}
    </div>
  );
  const r = size/2-8, circ = 2*Math.PI*r, off = circ-(score/5)*circ, col = scCol(score);
  return (
    <div style={{ textAlign:'center', width:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.bdr} strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s' }}/>
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fontSize={size*0.26} fontWeight="800" fill={col} style={{ transform:'rotate(90deg)', transformOrigin:'center' }}>{score.toFixed(1)}</text>
      </svg>
      {label && <div style={{ fontSize:11, color:C.mut, marginTop:3 }}>{label}</div>}
    </div>
  );
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
  const [competitors, setCompetitors] = useState({});
  const [strategy, setStrategy] = useState({});

  const v = venue ? VENUES.find(x => x.id === venue) : null;
  const rd = venue ? data[venue] : null;
  const comps = venue ? (competitors[venue] || []) : [];
  const strat = venue ? strategy[venue] : null;
  const hasData = rd && rd.overall_score > 0;

  const btn = (variant = 'gold') => ({
    padding:'10px 18px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
    display:'inline-flex', alignItems:'center', gap:7, transition:'all 0.2s',
    ...(variant === 'gold' ? { background:C.gold, color:C.navy } : variant === 'navy' ? { background:C.navy, color:C.white } : { background:'transparent', color:C.gold, border:`1.5px solid ${C.gold}` })
  });
  const card = { background:C.white, borderRadius:10, border:`1px solid ${C.bdr}`, padding:18, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' };
  const inp = { padding:'9px 12px', borderRadius:8, border:`1.5px solid ${C.bdr}`, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' };

  // ── Extract Reviews ──
  const extractReviews = async () => {
    if (!googleUrl.trim() || !v) { setError('Paste a Google Maps URL first.'); return; }
    setLoading('reviews'); setError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: googleUrl, venueName: v.name, venueType: v.type, reviewsLimit: 30, dateFrom, dateTo }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      setData(prev => ({ ...prev, [venue]: result }));
      setTab('reviews');
    } catch (e) { setError(e.message); }
    setLoading(null);
  };

  // ── Discover Competitors ──
  const findCompetitors = async () => {
    if (!v) return;
    setLoading('competitors'); setError(null);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueName: v.name, venueType: v.type, cuisine: v.cuisine, location: v.location, priceTier: v.price, occasions: v.occ }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      setCompetitors(prev => ({ ...prev, [venue]: result.competitors }));
    } catch (e) { setError(e.message); }
    setLoading(null);
  };

  // ── Generate Strategy ──
  const genStrategy = async () => {
    if (!v || !rd) return;
    setLoading('strategy'); setError(null);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueName: v.name, scores: { food: rd.food_score, service: rd.service_score, atmosphere: rd.atmosphere_score }, positives: rd.top_positives, negatives: rd.top_negatives, competitors: comps }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); setLoading(null); return; }
      setStrategy(prev => ({ ...prev, [venue]: result }));
    } catch (e) { setError(e.message); }
    setLoading(null);
  };

  // ── Renders ──
  const Spinner = ({ text }) => (
    <div style={{ textAlign:'center', padding:40 }}>
      <div style={{ width:40, height:40, border:`4px solid ${C.bdr}`, borderTop:`4px solid ${C.gold}`, borderRadius:'50%', margin:'0 auto 12px', animation:'spin 1s linear infinite' }}/>
      <div style={{ fontSize:13, color:C.mut }}>{text}</div>
    </div>
  );

  const Error = () => error ? (
    <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:12, marginBottom:12, fontSize:12, color:'#991b1b', display:'flex', alignItems:'center', gap:8 }}>
      ⚠️ {error}
      <button onClick={() => setError(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#991b1b', fontSize:14 }}>✕</button>
    </div>
  ) : null;

  if (!venue) return (
    <div style={{ fontFamily:'Georgia, serif', background:C.bg, minHeight:'100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>
      <div style={{ background:`linear-gradient(135deg,${C.navy},#16213e)`, color:C.white, padding:'20px 24px' }}>
        <div style={{ fontSize:22, fontWeight:700 }}>1-Group Review Intelligence</div>
        <div style={{ fontSize:12, color:C.goldL, letterSpacing:1, textTransform:'uppercase' }}>Outscraper + Claude AI · Real Reviews · Real Data</div>
      </div>
      <div style={{ padding:'20px 24px', maxWidth:1200, margin:'0 auto' }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.navy, marginBottom:6 }}>Select a Venue</h2>
        <p style={{ fontSize:13, color:C.mut, marginBottom:20 }}>Choose a venue to extract and analyse Google Reviews via Outscraper.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
          {VENUES.map(v => {
            const d = data[v.id]; const has = d && d.overall_score > 0;
            return (
              <div key={v.id} style={{ ...card, borderLeft:`4px solid ${has ? scCol(d.overall_score) : C.bdr}`, cursor:'pointer' }} onClick={() => { setVenue(v.id); setTab('dashboard'); }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.navy }}>{v.name}</div>
                    <div style={{ fontSize:11, color:C.mut }}>{v.type}</div>
                  </div>
                  {has && <Gauge score={d.overall_score} size={46}/>}
                </div>
                <div style={{ fontSize:11, color:C.mut }}>📍 {v.location}</div>
                {has ? <div style={{ fontSize:11, color:C.mut, marginTop:5 }}>⭐ {d.reviewCount} reviews · {d.scrapeDate}</div>
                  : <div style={{ fontSize:11, color:C.warn, fontWeight:600, marginTop:5 }}>Not yet analysed</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id:'dashboard', label:'📊 Dashboard' },
    { id:'reviews', label:'⭐ Reviews' },
    { id:'team', label:'👥 Team' },
    { id:'competitors', label:'🎯 Competitors' },
    { id:'benchmarks', label:'🏆 Benchmarks' },
    { id:'strategy', label:'⚡ Strategy' },
  ];

  return (
    <div style={{ fontFamily:'Georgia, serif', background:C.bg, minHeight:'100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box}`}</style>
      <div style={{ background:`linear-gradient(135deg,${C.navy},#16213e)`, color:C.white, padding:'14px 22px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ cursor:'pointer' }} onClick={() => setVenue(null)}>
          <div style={{ fontSize:19, fontWeight:700 }}>1-Group Review Intelligence</div>
          <div style={{ fontSize:11, color:C.goldL, letterSpacing:1, textTransform:'uppercase' }}>Outscraper + Claude AI</div>
        </div>
        <span style={{ fontSize:13, color:C.goldL, fontWeight:600 }}>{v?.name}</span>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:C.white, borderBottom:`2px solid ${C.bdr}`, overflowX:'auto', padding:'0 8px' }}>
        <button style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:C.navy, background:'none', border:'none', borderBottom:'3px solid transparent' }} onClick={() => setVenue(null)}>← Venues</button>
        <div style={{ width:1, height:18, background:C.bdr, alignSelf:'center' }}/>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, fontWeight:tab===t.id?700:500, color:tab===t.id?C.gold:C.mut, borderBottom:tab===t.id?`3px solid ${C.gold}`:'3px solid transparent', background:'none', border:'none', whiteSpace:'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:'18px 22px', maxWidth:1200, margin:'0 auto' }}>
        <Error/>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', background:C.white, borderRadius:8, border:`1px solid ${C.bdr}` }}>
              <button style={btn('navy')} onClick={() => setVenue(null)}>← All Venues</button>
              <div style={{ width:1, height:20, background:C.bdr }}/>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:C.navy }}>{v?.name}</div>
                <div style={{ fontSize:11, color:C.mut }}>{v?.type} · {v?.location} · {v?.price}</div>
              </div>
            </div>

            {loading === 'reviews' && <Spinner text="Extracting reviews from Google via Outscraper + scoring with AI..."/>}

            {loading !== 'reviews' && (
              <div style={{ ...card, borderLeft:`4px solid ${C.gold}` }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:6 }}>Extract Google Reviews</div>
                <div style={{ fontSize:12, color:C.mut, marginBottom:14, lineHeight:1.7 }}>
                  Paste your venue's <strong>Google Maps URL</strong> below. The tool will automatically extract all reviews via Outscraper and score them with AI.
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:C.mut, fontWeight:600, display:'block', marginBottom:4 }}>Google Maps URL</label>
                  <input type="url" value={googleUrl} onChange={e => setGoogleUrl(e.target.value)}
                    placeholder="e.g. https://maps.app.goo.gl/... or search term like 'Sol & Luna CapitaSpring Singapore'"
                    style={inp}/>
                </div>

                <div style={{ display:'flex', gap:14, marginBottom:14, flexWrap:'wrap' }}>
                  <div>
                    <label style={{ fontSize:11, color:C.mut, fontWeight:600, display:'block', marginBottom:4 }}>From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width:155 }}/>
                  </div>
                  <div style={{ paddingTop:22, color:C.mut }}>→</div>
                  <div>
                    <label style={{ fontSize:11, color:C.mut, fontWeight:600, display:'block', marginBottom:4 }}>To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, width:155 }}/>
                  </div>
                </div>

                <button onClick={extractReviews} disabled={loading || !googleUrl.trim()}
                  style={{ ...btn('gold'), padding:'14px 32px', fontSize:15, width:'100%', justifyContent:'center', opacity:(!googleUrl.trim() || loading) ? 0.5 : 1 }}>
                  🔍 Extract & Score Reviews
                </button>
                <div style={{ fontSize:11, color:C.mut, marginTop:8, textAlign:'center' }}>
                  Pulls real Google Reviews via Outscraper API → AI scores food/service/atmosphere. Takes 30-60 seconds.
                </div>
              </div>
            )}

            {hasData && loading !== 'reviews' && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14 }}>
                  <div style={{ ...card, flex:'1 1 170px', textAlign:'center' }}><Gauge score={rd.overall_score} label="Overall" size={88}/><div style={{ fontSize:11, color:C.mut, marginTop:3 }}>{scLbl(rd.overall_score)}</div></div>
                  <div style={{ ...card, flex:'1 1 170px', textAlign:'center' }}><Gauge score={rd.food_score} label="Food" size={72}/></div>
                  <div style={{ ...card, flex:'1 1 170px', textAlign:'center' }}><Gauge score={rd.service_score} label="Service" size={72}/></div>
                  <div style={{ ...card, flex:'1 1 170px', textAlign:'center' }}><Gauge score={rd.atmosphere_score} label="Atmosphere" size={72}/></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={card}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.pos, marginBottom:4 }}>✦ Strengths</div>
                    {(rd.top_positives || []).map((p, i) => <div key={i} style={{ fontSize:12, padding:'3px 0', borderBottom:`1px solid ${C.bdr}` }}>{p}</div>)}
                  </div>
                  <div style={card}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.neg, marginBottom:4 }}>⚠ Weaknesses</div>
                    {(rd.top_negatives || []).map((n, i) => <div key={i} style={{ fontSize:12, padding:'3px 0', borderBottom:`1px solid ${C.bdr}` }}>{n}</div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REVIEWS */}
        {tab === 'reviews' && hasData && (
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:C.navy, marginBottom:10 }}>{v?.name} — {rd.reviewCount || rd.reviews?.length} Reviews</h2>
            <div style={{ fontSize:12, color:C.mut, marginBottom:12, padding:'7px 10px', background:'#f0f4f8', borderRadius:6 }}>
              <strong>Google Rating:</strong> {rd.googleRating}/5 · <strong>Period:</strong> {rd.period} · <strong>Reviews scored:</strong> {rd.reviews?.length}
            </div>
            <div style={{ display:'flex', gap:12, marginBottom:14 }}>
              <Gauge score={rd.food_score} label="Food" size={64}/>
              <Gauge score={rd.service_score} label="Service" size={64}/>
              <Gauge score={rd.atmosphere_score} label="Atmosphere" size={64}/>
            </div>
            {(rd.reviews || []).map((r, i) => (
              <div key={i} style={{ ...card, animation:`fadeIn 0.3s ease ${i*0.03}s both` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700, color:C.white, background:C.gold }}>google</span>
                    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:(r.sentiment==='positive'?C.pos:r.sentiment==='negative'?C.neg:C.warn)+'18', color:r.sentiment==='positive'?C.pos:r.sentiment==='negative'?C.neg:C.warn }}>{r.sentiment}</span>
                    {r.rating && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>{'★'.repeat(Math.round(r.rating))}</span>}
                  </div>
                  <span style={{ fontSize:11, color:C.mut }}>{r.date}{r.author && ` · ${r.author}`}</span>
                </div>
                <p style={{ fontSize:12, lineHeight:1.6, margin:'0 0 5px' }}>{r.summary || r.text?.slice(0, 150)}</p>
                <div style={{ display:'flex', gap:12, fontSize:11 }}>
                  <span style={{ color:scCol(r.food_score) }}>Food: {r.food_score}/5</span>
                  <span style={{ color:scCol(r.service_score) }}>Service: {r.service_score}/5</span>
                  <span style={{ color:scCol(r.atmosphere_score) }}>Atm: {r.atmosphere_score}/5</span>
                </div>
                {r.key_themes?.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>{r.key_themes.map((t, j) => <span key={j} style={{ fontSize:10, background:C.bg, padding:'2px 7px', borderRadius:10, color:C.mut }}>{t}</span>)}</div>}
              </div>
            ))}
          </div>
        )}
        {tab === 'reviews' && !hasData && <div style={{ textAlign:'center', padding:50, color:C.mut }}><div style={{ fontSize:40 }}>⭐</div><div style={{ fontSize:15, fontWeight:700, color:C.navy, marginTop:8 }}>No reviews yet</div><div style={{ fontSize:13 }}>Go to Dashboard to extract reviews.</div></div>}

        {/* TEAM */}
        {tab === 'team' && (
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:C.navy, marginBottom:10 }}>{v?.name} — Team</h2>
            {(rd?.team_mentions || []).length > 0 ? rd.team_mentions.map((m, i) => (
              <div key={i} style={{ ...card, borderLeft:`4px solid ${m.avg_sentiment === 'positive' ? C.gold : C.bdr}`, display:'flex', gap:10, padding:14 }}>
                <div style={{ fontSize:20 }}>✨</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{m.name}</div>
                  <div style={{ fontSize:11, color:C.mut }}>{m.role} · {m.mention_count} mentions · {m.avg_sentiment}</div>
                  <div style={{ fontSize:12, color:C.mut, fontStyle:'italic', marginTop:4 }}>{m.sample_context}</div>
                </div>
              </div>
            )) : <div style={{ textAlign:'center', padding:50, color:C.mut }}><div style={{ fontSize:40 }}>👥</div><div style={{ fontSize:15, fontWeight:700, color:C.navy, marginTop:8 }}>No team members found</div><div style={{ fontSize:13 }}>Staff names are extracted from review text.</div></div>}
          </div>
        )}

        {/* COMPETITORS */}
        {tab === 'competitors' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ fontSize:19, fontWeight:700, color:C.navy, margin:0 }}>{v?.name} — Competitors</h2>
              {!comps.length && <button style={btn('gold')} onClick={findCompetitors} disabled={loading==='competitors'}>
                {loading === 'competitors' ? '🔄 Finding...' : '🔍 Discover Competitors'}
              </button>}
            </div>
            {loading === 'competitors' && <Spinner text="AI is searching for competitors..."/>}
            {comps.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:8 }}>Direct ({comps.filter(c => c.type === 'direct').length})</div>
                  {comps.filter(c => c.type === 'direct').map((c, i) => (
                    <div key={i} style={card}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:C.mut }}>{c.cuisine} · {c.location}</div>
                      {c.google_rating && <div style={{ fontSize:11, marginTop:2 }}>★ {c.google_rating} · {c.price_range}</div>}
                      <p style={{ fontSize:11, color:C.mut, marginTop:4 }}>{c.reason}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.mut, marginBottom:8 }}>Indirect ({comps.filter(c => c.type !== 'direct').length})</div>
                  {comps.filter(c => c.type !== 'direct').map((c, i) => (
                    <div key={i} style={card}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:C.mut }}>{c.cuisine} · {c.location}</div>
                      {c.google_rating && <div style={{ fontSize:11, marginTop:2 }}>★ {c.google_rating} · {c.price_range}</div>}
                      <p style={{ fontSize:11, color:C.mut, marginTop:4 }}>{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!comps.length && !loading && <div style={{ textAlign:'center', padding:50, color:C.mut }}><div style={{ fontSize:40 }}>🎯</div><div style={{ fontSize:15, fontWeight:700, color:C.navy, marginTop:8 }}>No competitors yet</div><div style={{ fontSize:13 }}>Click Discover to find 10 competitors.</div></div>}
          </div>
        )}

        {/* BENCHMARKS */}
        {tab === 'benchmarks' && (
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:C.navy, marginBottom:12 }}>{v?.name} — Benchmarks</h2>
            {hasData && comps.length > 0 ? (() => {
              const all = [{ name: v.name, score: rd.overall_score, isOwn: true }, ...comps.filter(c => c.google_rating).map(c => ({ name: c.name, score: c.google_rating, isOwn: false }))].sort((a, b) => (b.score || 0) - (a.score || 0));
              return (
                <div style={{ ...card, overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ borderBottom:`2px solid ${C.navy}` }}><th style={{ textAlign:'left', padding:'7px 10px' }}>#</th><th style={{ textAlign:'left', padding:'7px 10px' }}>Venue</th><th style={{ textAlign:'center', padding:'7px 10px' }}>Score</th></tr></thead>
                    <tbody>{all.map((v, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.bdr}`, background:v.isOwn?'#fdf8e8':'transparent' }}>
                        <td style={{ padding:'7px 10px', fontWeight:700, color:C.mut }}>{i + 1}</td>
                        <td style={{ padding:'7px 10px', fontWeight:v.isOwn?800:500, color:v.isOwn?C.gold:C.text }}>{v.name}{v.isOwn && <span style={{ fontSize:9, background:C.gold, color:C.white, padding:'1px 4px', borderRadius:3, marginLeft:4 }}>YOU</span>}</td>
                        <td style={{ textAlign:'center', padding:'7px 10px', fontWeight:700, color:scCol(v.score) }}>{v.score?.toFixed(1)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              );
            })() : <div style={{ textAlign:'center', padding:50, color:C.mut }}><div style={{ fontSize:40 }}>🏆</div><div style={{ fontSize:15, fontWeight:700, color:C.navy, marginTop:8 }}>{!hasData ? 'Import reviews first' : 'Discover competitors first'}</div></div>}
          </div>
        )}

        {/* STRATEGY */}
        {tab === 'strategy' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ fontSize:19, fontWeight:700, color:C.navy, margin:0 }}>{v?.name} — Strategy</h2>
              {hasData && <button style={btn('gold')} onClick={genStrategy} disabled={loading==='strategy'}>
                {loading === 'strategy' ? '🔄 Generating...' : '⚡ Generate'}
              </button>}
            </div>
            {loading === 'strategy' && <Spinner text="Generating strategic recommendations..."/>}
            {strat && !loading && (
              <div>
                <div style={{ ...card, borderLeft:`4px solid ${C.gold}` }}>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:5 }}>Executive Summary</div>
                  <p style={{ fontSize:13, lineHeight:1.7, margin:0 }}>{strat.executive_summary}</p>
                </div>
                {[{ t:'Food', d:strat.food_recommendations, c:C.pos }, { t:'Service', d:strat.service_recommendations, c:C.gold }, { t:'Atmosphere', d:strat.atmosphere_recommendations, c:C.warn }].map(sec => sec.d?.length > 0 && (
                  <div key={sec.t} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, marginBottom:6, color:sec.c }}>{sec.t}</div>
                    {sec.d.map((r, i) => (
                      <div key={i} style={{ ...card, display:'flex', gap:8, padding:12 }}>
                        <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700, color:C.white, background:r.priority==='high'?C.neg:r.priority==='medium'?C.warn:C.pos }}>{r.priority}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{r.recommendation}</div>
                          <div style={{ fontSize:11, color:C.mut }}>Based on: {r.based_on}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {strat.quick_wins?.length > 0 && <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>⚡ Quick Wins</div>
                  {strat.quick_wins.map((q, i) => <div key={i} style={{ ...card, padding:12 }}><div style={{ fontSize:12, fontWeight:600 }}>{q.action}</div><div style={{ fontSize:11, color:C.mut }}>{q.timeline} · {q.expected_impact}</div></div>)}
                </div>}
              </div>
            )}
            {!strat && !loading && <div style={{ textAlign:'center', padding:50, color:C.mut }}><div style={{ fontSize:40 }}>⚡</div><div style={{ fontSize:15, fontWeight:700, color:C.navy, marginTop:8 }}>{hasData ? 'Click Generate above' : 'Import reviews first'}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}
