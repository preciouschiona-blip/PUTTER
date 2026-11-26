const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'cd', 'club', 'de', 'the', 'fk', 'sk', 'if', 'bk', 'ud', 'rc', 'real', 'sv', 'vfl', 'vfb', 'tsg', 'ssc', 'us', 'ss', 'ca', 'cs', 'and']);
const ALIAS = { 'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city', 'spurs': 'tottenham', 'tottenham hotspur': 'tottenham', 'wolves': 'wolverhampton', 'wolverhampton wanderers': 'wolverhampton', 'newcastle utd': 'newcastle', 'newcastle united': 'newcastle', 'nottm forest': 'nottingham forest', 'inter': 'internazionale', 'inter milan': 'internazionale', 'atletico madrid': 'atletico', 'atl madrid': 'atletico', 'paris saint germain': 'psg', 'paris sg': 'psg', 'paris saint germain fc': 'psg', 'bayern munich': 'bayern', 'bayern munchen': 'bayern', 'borussia monchengladbach': 'gladbach', 'leverkusen': 'bayer leverkusen' };

export function norm(name) {
  let s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const strip = x => x.split(' ').filter(t => t && !STOP.has(t)).join(' ');
  s = ALIAS[s] ?? ALIAS[strip(s)] ?? s;
  const toks = strip(s).split(' ').filter(Boolean);
  return toks.length ? toks : s.split(' ');
}
export function nameScore(a, b) {
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const jac = inter / (A.size + B.size - inter);
  const sub = [...A].join(' ').includes([...B].join(' ')) || [...B].join(' ').includes([...A].join(' ')) ? 0.8 : 0;
  return Math.max(jac, sub);
}
/** Matches an odds-feed event to an API-Football fixture. Returns a score or 0. */
export function matchScore(fx, ev) {
  const dt = Math.abs(new Date(fx.kickoff) - new Date(ev.commence_time)) / 60000;
  if (dt > 120) return 0;
  const s = Math.min(nameScore(fx.home, ev.home_team), nameScore(fx.away, ev.away_team));
  return s >= 0.5 ? s : 0;
}
