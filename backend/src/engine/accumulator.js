// Accumulator maths with same-match correlation handled exactly from the scoreline matrix.
import { jointWinProb } from './poisson.js';

/**
 * legs: [{ fixtureId, marketId, odds, p, matrix? }]
 * Legs on different fixtures are treated as independent. Two legs on the same fixture use the exact
 * joint probability from the stored matrix; 3+ legs on one fixture fall back to the Fréchet lower
 * bound (conservative) because pairwise joints cannot be combined exactly.
 */
export function combine(legs, stake = 1) {
  const groups = new Map();
  for (const l of legs) { if (!groups.has(l.fixtureId)) groups.set(l.fixtureId, []); groups.get(l.fixtureId).push(l); }
  let prob = 1; let correlated = false;
  for (const g of groups.values()) {
    if (g.length === 1) prob *= g[0].p;
    else if (g.length === 2 && g[0].matrix) { correlated = true; prob *= jointWinProb(g[0].matrix, g[0].marketId, g[1].marketId); }
    else { correlated = true; prob *= Math.max(0, g.reduce((s, l) => s + l.p, 0) - (g.length - 1)); }
  }
  const odds = legs.reduce((o, l) => o * l.odds, 1);
  const risk = legs.length >= 6 || prob < 0.08 ? 'VERY HIGH' : legs.length >= 4 || prob < 0.18 ? 'HIGH' : legs.length >= 3 || prob < 0.35 ? 'MEDIUM' : 'MODERATE';
  return { selections: legs.length, combinedOdds: odds, probability: prob, payout: stake * odds, profit: stake * (odds - 1), ev: prob * odds - 1, risk, correlated };
}
