import test from 'node:test';
import assert from 'node:assert/strict';
import { matchScore, nameScore } from '../src/providers/teamMatch.js';
import { summariseEvent } from '../src/providers/oddsApi.js';
import { analyseFixture } from '../src/engine/analysis.js';
import { demoBundles } from '../src/demo.js';
import { formFromCache } from '../src/providers/form.js';

test('team name matching across feeds', () => {
  assert.ok(nameScore('Manchester United', 'Manchester Utd') >= 0.5);
  assert.ok(nameScore('Paris Saint Germain', 'Paris Saint-Germain FC') >= 0.5);
  assert.ok(nameScore('Arsenal', 'Chelsea') < 0.5);
  const fx = { kickoff: '2026-12-01T15:00:00Z', home: 'Brighton & Hove Albion', away: 'Wolves' };
  assert.ok(matchScore(fx, { commence_time: '2026-12-01T15:00:00Z', home_team: 'Brighton and Hove Albion', away_team: 'Wolverhampton Wanderers' }) > 0);
  assert.equal(matchScore(fx, { commence_time: '2026-12-02T15:00:00Z', home_team: 'Brighton and Hove Albion', away_team: 'Wolves' }), 0);
});

test('odds feed summary: best price, average, groups', () => {
  const ev = { home_team: 'A', away_team: 'B', bookmakers: [
    { title: 'Bk1', markets: [{ key: 'h2h', last_update: 't1', outcomes: [{ name: 'A', price: 2.0 }, { name: 'Draw', price: 3.4 }, { name: 'B', price: 4.0 }] }, { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.9 }, { name: 'Under', point: 2.5, price: 1.95 }, { name: 'Over', point: 4.5, price: 5 }] }] },
    { title: 'Bk2', markets: [{ key: 'h2h', last_update: 't2', outcomes: [{ name: 'A', price: 2.2 }, { name: 'Draw', price: 3.3 }, { name: 'B', price: 3.8 }] }] },
  ] };
  const s = summariseEvent(ev);
  assert.equal(s.selections['1X2:H'].best, 2.2); assert.equal(s.selections['1X2:H'].bookmaker, 'Bk2'); assert.equal(s.selections['1X2:H'].count, 2);
  assert.ok(Math.abs(s.selections['1X2:H'].avg - 2.1) < 1e-9);
  assert.deepEqual(s.groups, [['1X2:H', '1X2:D', '1X2:A'], ['OU:2.5:O', 'OU:2.5:U']]);
  assert.equal(s.selections['OU:4.5:O'], undefined);
});

test('demo bundles are flagged and can never be GREEN', () => {
  let n = 0;
  for (const b of demoBundles(new Date('2026-12-01T10:00:00Z'))) {
    const r = analyseFixture(b);
    assert.ok(r.picks.every(p => p.is_demo && p.grade !== 'GREEN'));
    n += r.picks.length;
  }
  assert.ok(n > 0, 'demo mode must actually produce demo picks');
});

test('team form from cached results: newest first, team perspective', () => {
  const r = (id, kickoff, h, a, hg, ag) => ({ fixture_id: id, kickoff, home_id: h, away_id: a, home_goals: hg, away_goals: ag, league: 'L' });
  const rows = [r('1', '2026-10-01T15:00:00Z', 10, 20, 2, 1), r('2', '2026-10-08T15:00:00Z', 30, 10, 0, 0), r('3', '2026-10-15T15:00:00Z', 10, 40, 1, 3), r('4', '2026-10-20T15:00:00Z', 50, 60, 5, 5)];
  const f = formFromCache(rows, 10);
  assert.equal(f.length, 3);
  assert.deepEqual(f.map(x => [x.venue, x.gf, x.ga]), [['H', 1, 3], ['A', 0, 0], ['H', 2, 1]]);
  assert.equal(formFromCache(rows, 10, 2).length, 2);
  assert.equal(formFromCache(rows, 99).length, 0);
});
