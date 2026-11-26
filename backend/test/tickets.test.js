import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTickets, settleTicket, isBanker } from '../src/engine/tickets.js';

const NOW = new Date('2026-12-01T08:00:00Z');
let n = 0;
const pk = (fx, market, odds, p, o = {}) => ({
  id: `p${++n}`, fixture_id: String(fx), market_id: market, market_label: market, selection_label: market, home_team: `H${fx}`, away_team: `A${fx}`,
  league: 'L', kickoff: '2026-12-01T15:00:00Z', odds, p_adj: p, grade: 'GREEN', confidence: 60, score: 50 + n, result: 'PENDING', ...o,
});
const pool = (k) => Array.from({ length: k }, (_, i) => pk(i + 1, i % 2 ? 'OU:2.5:O' : '1X2:H', 2.1 + (i % 4) * 0.2, 0.5 - (i % 3) * 0.02));
const ids = t => t.legs.map(l => l.fixture_id);

test('three tickets from a rich pool, no repeated match when no bankers', () => {
  const t = buildTickets(pool(12), [], {}, NOW);
  assert.equal(t.length, 3);
  const all = t.flatMap(ids);
  assert.equal(new Set(all).size, all.length, 'no match repeated');
  for (const x of t) { assert.ok(x.combined_odds >= 8); assert.ok(x.ev > 0); assert.ok(new Set(ids(x)).size === x.legs.length); }
  assert.ok(t[2].combined_odds >= t[0].combined_odds, 'ticket 3 has the highest odds');
});
test('small pool gives fewer tickets instead of repeating matches', () => {
  const t = buildTickets(pool(4), [], {}, NOW);
  assert.ok(t.length >= 1 && t.length < 3);
  const all = t.flatMap(ids); assert.equal(new Set(all).size, all.length);
});
test('a banker may be reused once, a normal pick may not', () => {
  const p = pool(5);
  p[0] = pk(1, '1X2:H', 2.0, 0.7, { confidence: 80, score: 999 });
  assert.ok(isBanker(p[0]));
  const t = buildTickets(p, [], {}, NOW);
  const count = t.flatMap(ids).filter(x => x === '1').length;
  assert.ok(count <= 2);
  const p2 = pool(5).map(x => ({ ...x, confidence: 50 }));
  const t2 = buildTickets(p2, [], {}, NOW);
  const all = t2.flatMap(ids); assert.equal(new Set(all).size, all.length);
});
test('only missing slots are built and existing matches stay used', () => {
  const first = buildTickets(pool(12), [], {}, NOW);
  const rest = buildTickets(pool(12), [first[0]], {}, NOW);
  assert.deepEqual(rest.map(r => r.slot), [2, 3]);
  const all = [...ids(first[0]), ...rest.flatMap(ids)];
  assert.equal(new Set(all).size, all.length);
});
test('started, settled, low-odds and RED picks are excluded', () => {
  const p = [pk(1, '1X2:H', 2.2, 0.5, { kickoff: '2026-12-01T08:05:00Z' }), pk(2, '1X2:H', 1.8, 0.6), pk(3, '1X2:H', 2.2, 0.5, { result: 'WON' }), pk(4, 'BTTS:Y', 2.2, 0.5, { grade: 'RED' })];
  assert.equal(buildTickets(p, [], {}, NOW).length, 0);
});
test('ticket grade is AMBER when any leg is AMBER', () => {
  const p = pool(5); p[1].grade = 'AMBER';
  const t = buildTickets(p, [], {}, NOW);
  for (const x of t) assert.equal(x.grade, x.legs.every(l => l.grade === 'GREEN') ? 'GREEN' : 'AMBER');
});
test('ticket settlement', () => {
  assert.deepEqual(settleTicket(['WON', 'WON', 'WON'], [2, 2.1, 2.2]), { result: 'WON', profit: +(2 * 2.1 * 2.2 - 1).toFixed(4) });
  assert.deepEqual(settleTicket(['WON', 'LOST', 'PENDING'], [2, 2, 2]), { result: 'LOST', profit: -1 });
  assert.equal(settleTicket(['WON', 'PENDING'], [2, 2]).result, 'PENDING');
  assert.deepEqual(settleTicket(['WON', 'VOID', 'WON'], [2, 2, 2.5]), { result: 'WON', profit: 4 });
  assert.equal(settleTicket(['VOID', 'VOID'], [2, 2]).result, 'VOID');
});
