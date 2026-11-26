import test from 'node:test';
import assert from 'node:assert/strict';
import { pmf, scoreMatrix, marketProb, jointWinProb, sumMatrix } from '../src/engine/poisson.js';
import { devig, expectedValue, evaluateSelection } from '../src/engine/value.js';
import { predictMatch, marketView } from '../src/engine/model.js';
import { settlePick } from '../src/engine/settle.js';
import { combine } from '../src/engine/accumulator.js';
import { analyseFixture } from '../src/engine/analysis.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const team = (gf, ga, n = 12) => Array.from({ length: n }, (_, i) => ({ venue: i % 2 ? 'H' : 'A', gf: gf[i % gf.length], ga: ga[i % ga.length] }));

test('pmf sums to ~1 and matrix is normalised', () => {
  let s = 0; for (let k = 0; k < 40; k++) s += pmf(k, 2.3); near(s, 1, 1e-9);
  near(sumMatrix(scoreMatrix(1.6, 1.1), () => true), 1);
});
test('1X2 probabilities sum to 1; known league-average game looks sane', () => {
  const m = scoreMatrix(1.5, 1.2);
  const p = ['H', 'D', 'A'].map(x => marketProb(m, `1X2:${x}`).win);
  near(p.reduce((a, b) => a + b), 1);
  assert.ok(p[0] > 0.4 && p[0] < 0.55, `home ${p[0]}`);
  assert.ok(p[1] > 0.22 && p[1] < 0.32, `draw ${p[1]}`);
});
test('over/under and BTTS complements', () => {
  const m = scoreMatrix(1.4, 1.3);
  near(marketProb(m, 'OU:2.5:O').win + marketProb(m, 'OU:2.5:U').win, 1);
  near(marketProb(m, 'BTTS:Y').win + marketProb(m, 'BTTS:N').win, 1);
  assert.ok(marketProb(m, 'OU:2.0:O').push > 0, 'whole line has push');
});
test('draw no bet pushes on a draw', () => {
  const m = scoreMatrix(1.4, 1.3);
  near(marketProb(m, 'DNB:H').push, marketProb(m, '1X2:D').win);
});
test('same-match joint probability is exact and differs from the product', () => {
  const m = scoreMatrix(1.8, 1.0);
  const j = jointWinProb(m, '1X2:H', 'OU:2.5:O');
  const prod = marketProb(m, '1X2:H').win * marketProb(m, 'OU:2.5:O').win;
  assert.ok(Math.abs(j - prod) > 0.01);
  assert.ok(j <= Math.min(marketProb(m, '1X2:H').win, marketProb(m, 'OU:2.5:O').win));
});
test('devig removes the margin', () => {
  const { fair, margin } = devig([2.0, 3.5, 4.0]);
  near(fair.reduce((a, b) => a + b), 1); assert.ok(margin > 0);
});
test('EV formula', () => {
  near(expectedValue(0.5, 0, 2.2), 0.1);
  near(expectedValue(0.45, 0.1, 2.0), 0.45 - 0.45);
});
test('grading: low odds are RED, unverified odds are RED, big raw edge is not GREEN', () => {
  const base = { pModel: 0.55, pPush: 0, pMarketFair: 0.5, quality: 0.9, spread: 0.02 };
  assert.equal(evaluateSelection({ ...base, odds: 1.8 }).grade, 'RED');
  assert.equal(evaluateSelection({ ...base, odds: 2.3, oddsVerified: false }).grade, 'RED');
  const g = evaluateSelection({ ...base, odds: 2.3 });
  assert.equal(g.grade, 'GREEN');
  assert.notEqual(evaluateSelection({ ...base, pModel: 0.8, odds: 2.3 }).grade, 'GREEN');
  assert.notEqual(evaluateSelection({ ...base, quality: 0.3, odds: 2.3 }).grade, 'GREEN');
});
test('strong home side vs weak away side gives a clear home edge', () => {
  const pred = predictMatch({ id: 'x1', home: { matches: team([3, 2, 2, 4], [0, 1, 0]) }, away: { matches: team([0, 1, 0], [3, 2, 2, 3]) }, flags: {} });
  assert.ok(pred.ok);
  assert.ok(marketView(pred, '1X2:H').win > 0.6);
  near(['H', 'D', 'A'].map(x => marketView(pred, `1X2:${x}`).win).reduce((a, b) => a + b), 1, 1e-6);
});
test('prediction is deterministic for a fixture id', () => {
  const inp = { id: 'fixed', home: { matches: team([2, 1], [1]) }, away: { matches: team([1], [1, 2]) }, flags: {} };
  assert.equal(marketView(predictMatch(inp), 'OU:2.5:O').win, marketView(predictMatch(inp), 'OU:2.5:O').win);
});
test('too little data is skipped, not guessed', () => {
  assert.equal(predictMatch({ id: 'y', home: { matches: team([1], [1], 3) }, away: { matches: team([1], [1], 3) } }).ok, false);
});
test('settlement', () => {
  assert.deepEqual(settlePick('OU:2.5:O', 2.1, 2, 1), { status: 'WON', profit: 1.1 });
  assert.deepEqual(settlePick('1X2:H', 2.5, 0, 0), { status: 'LOST', profit: -1 });
  assert.deepEqual(settlePick('DNB:H', 2.2, 1, 1), { status: 'VOID', profit: 0 });
  assert.equal(settlePick('BTTS:Y', 2, 1, 1).status, 'WON');
});
test('accumulator handles same-match correlation and different matches', () => {
  const m = scoreMatrix(1.8, 1.0);
  const a = combine([{ fixtureId: 1, marketId: '1X2:H', odds: 2.1, p: 0.5, matrix: m }, { fixtureId: 2, marketId: 'BTTS:Y', odds: 2.0, p: 0.5 }]);
  near(a.combinedOdds, 4.2); near(a.probability, 0.25); assert.equal(a.correlated, false);
  const b = combine([{ fixtureId: 1, marketId: '1X2:H', odds: 2.1, p: 0.5, matrix: m }, { fixtureId: 1, marketId: 'OU:2.5:O', odds: 2.0, p: 0.5, matrix: m }]);
  assert.equal(b.correlated, true);
  near(b.probability, jointWinProb(m, '1X2:H', 'OU:2.5:O'));
});
test('analyseFixture never publishes without odds and labels demo data', () => {
  const bundle = {
    fixture: { id: 7, kickoff: '2026-12-01T15:00:00Z', league: 'Test League', home: 'A FC', away: 'B FC' },
    home: { matches: team([2, 3, 1], [1, 0]), injuries: { missing: [], questionable: [] } },
    away: { matches: team([1, 0], [2, 3, 1]), injuries: { missing: [], questionable: [] } },
    flags: { hasStandings: true, injuriesChecked: true }, odds: null,
  };
  assert.equal(analyseFixture(bundle).picks.length, 0);
  bundle.odds = { selections: { '1X2:H': { best: 2.4, avg: 2.25, bookmaker: 'Demo', updated: 'x', count: 5 }, '1X2:D': { best: 3.6, avg: 3.4, count: 5 }, '1X2:A': { best: 3.2, avg: 3.0, count: 5 } }, groups: [['1X2:H', '1X2:D', '1X2:A']] };
  bundle.isDemo = true;
  const r = analyseFixture(bundle);
  assert.ok(r.picks.every(p => p.is_demo && p.grade !== 'GREEN'), 'demo odds can never be GREEN');
});
