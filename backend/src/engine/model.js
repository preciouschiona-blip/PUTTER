// Three independent-ish goal models blended into one scoreline matrix.
import { scoreMatrix, MAX_GOALS, allMarketProbs, marketProb } from './poisson.js';

export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

const DECAY = 0.92; // weight multiplier per match back in time
const SHRINK_K = 6; // pseudo-matches of league-average behaviour

/** matches: newest first. Each {venue:'H'|'A', gf, ga, xgf?, xga?}. */
function weightedStats(matches, venue = null) {
  let w = 0, gf = 0, ga = 0, gd = 0, tot = 0, xgSeen = 0;
  matches.forEach((m, i) => {
    if (venue && m.venue !== venue) return;
    const wt = Math.pow(DECAY, i);
    const f = m.xgf != null ? 0.6 * m.xgf + 0.4 * m.gf : m.gf;
    const a = m.xga != null ? 0.6 * m.xga + 0.4 * m.ga : m.ga;
    if (m.xgf != null) xgSeen++;
    w += wt; gf += wt * f; ga += wt * a; gd += wt * (m.gf - m.ga); tot += wt * (m.gf + m.ga);
  });
  return w === 0 ? null : { w, gf: gf / w, ga: ga / w, gd: gd / w, tot: tot / w, n: matches.filter(m => !venue || m.venue === venue).length, xgSeen };
}

export function leagueAverages(homeMatches, awayMatches, override = null) {
  if (override?.home && override?.away) return override;
  let hg = 0, ag = 0, n = 0;
  for (const m of [...homeMatches, ...awayMatches]) {
    hg += m.venue === 'H' ? m.gf : m.ga; ag += m.venue === 'H' ? m.ga : m.gf; n++;
  }
  if (n < 6) return { home: 1.5, away: 1.2 };
  return { home: hg / n, away: ag / n };
}

function blendVenue(overall, venueStats) {
  if (!venueStats || venueStats.n < 3) return overall;
  const b = 0.35;
  return { gf: (1 - b) * overall.gf + b * venueStats.gf, ga: (1 - b) * overall.ga + b * venueStats.ga, w: overall.w };
}

function rating(s, league) {
  const att = (s.w * (s.gf / league) + SHRINK_K) / (s.w + SHRINK_K);
  const def = (s.w * (s.ga / league) + SHRINK_K) / (s.w + SHRINK_K);
  return { att, def };
}

const clampL = x => Math.min(4.5, Math.max(0.2, x));

/** Model A: attack/defence strength Poisson with home/away adjustment. */
function modelA(h, a, lg) {
  const mean = (lg.home + lg.away) / 2;
  const hs = blendVenue(h.all, h.home), as = blendVenue(a.all, a.away);
  const hr = rating(hs, mean), ar = rating(as, mean);
  return { lh: clampL(lg.home * hr.att * ar.def), la: clampL(lg.away * ar.att * hr.def) };
}

/** Model B: goal-difference rating plus expected total goals. */
function modelB(h, a, lg) {
  const shr = (v, w) => (w * v) / (w + SHRINK_K);
  const rh = shr(h.all.gd, h.all.w), ra = shr(a.all.gd, a.all.w);
  const homeAdv = lg.home - lg.away;
  const diff = homeAdv + 0.85 * (rh - ra);
  const leagueTot = lg.home + lg.away;
  const tot = (leagueTot * SHRINK_K + 0.5 * (h.all.tot + a.all.tot) * Math.min(h.all.w, a.all.w)) / (SHRINK_K + Math.min(h.all.w, a.all.w));
  return { lh: clampL((tot + diff) / 2), la: clampL((tot - diff) / 2) };
}

function applyInjuries(l, injH, injA) {
  const aH = Math.min(0.25, injH?.attackLoss ?? 0), aA = Math.min(0.25, injA?.attackLoss ?? 0);
  const dH = Math.min(0.15, injH?.defenceLoss ?? 0), dA = Math.min(0.15, injA?.defenceLoss ?? 0);
  return { lh: clampL(l.lh * (1 - aH) * (1 + dA)), la: clampL(l.la * (1 - aA) * (1 + dH)) };
}

function monteCarlo(lh, la, seed, sigma, n = 40000) {
  const rng = mulberry32(seed);
  const size = MAX_GOALS + 1;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < n; i++) {
    const kh = Math.exp(sigma * gauss(rng) - 0.5 * sigma * sigma);
    const ka = Math.exp(sigma * gauss(rng) - 0.5 * sigma * sigma);
    const gh = Math.min(MAX_GOALS, poissonSample(lh * kh, rng));
    const ga = Math.min(MAX_GOALS, poissonSample(la * ka, rng));
    m[gh][ga] += 1;
  }
  for (const r of m) for (let j = 0; j < size; j++) r[j] /= n;
  return m;
}

function mixMatrices(list) {
  const size = MAX_GOALS + 1;
  const out = Array.from({ length: size }, () => new Array(size).fill(0));
  for (const { m, w } of list) for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) out[i][j] += w * m[i][j];
  return out;
}

/**
 * input: { id, home:{matches,injuries?}, away:{matches,injuries?}, leagueAvg?, flags:{hasStandings, injuriesChecked, bookmakers} }
 * Returns lambdas, per-model matrices, ensemble matrix, quality score.
 */
export function predictMatch(input) {
  const hm = input.home.matches, am = input.away.matches;
  if (hm.length < 4 || am.length < 4) return { ok: false, reason: 'Not enough recent matches for both teams' };
  const lg = leagueAverages(hm, am, input.leagueAvg);
  const prep = ms => ({ all: weightedStats(ms), home: weightedStats(ms, 'H'), away: weightedStats(ms, 'A') });
  const h = prep(hm), a = prep(am);

  const A = applyInjuries(modelA(h, a, lg), input.home.injuries, input.away.injuries);
  const B = applyInjuries(modelB(h, a, lg), input.home.injuries, input.away.injuries);
  const n = Math.min(hm.length, am.length);
  const sigma = Math.max(0.1, 0.28 - 0.012 * n); // more uncertainty with less data
  const seed = hashSeed(String(input.id));
  const models = {
    poisson_form: { m: scoreMatrix(A.lh, A.la), lambdas: A, w: 0.4 },
    goal_diff_rating: { m: scoreMatrix(B.lh, B.la), lambdas: B, w: 0.25 },
    monte_carlo: { m: monteCarlo(A.lh, A.la, seed, sigma), lambdas: A, w: 0.35 },
  };
  const ensemble = mixMatrices(Object.values(models));

  const xg = Math.min(h.all.xgSeen, a.all.xgSeen) / Math.max(1, n);
  const f = input.flags ?? {};
  const quality = Math.min(1,
    0.4 * Math.min(1, n / 10) + 0.15 * Math.min(1, xg) + 0.1 * (f.hasStandings ? 1 : 0) +
    0.15 * (f.injuriesChecked ? 1 : 0) + 0.2 * Math.min(1, (f.bookmakers ?? 0) / 3));
  return { ok: true, leagueAvg: lg, models, ensemble, quality, sampleSize: n, lambdas: { home: (A.lh + B.lh) / 2, away: (A.la + B.la) / 2 } };
}

/** Per-market ensemble probabilities with cross-model spread. */
export function marketView(pred, marketId) {
  const e = marketProb(pred.ensemble, marketId);
  const per = Object.values(pred.models).map(x => marketProb(x.m, marketId).win);
  return { win: e.win, push: e.push, spread: Math.max(...per) - Math.min(...per), perModel: per };
}
export { allMarketProbs };
