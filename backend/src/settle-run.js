// Settles finished matches and updates the permanent track record (result columns only).
import * as db from './db.js';
import * as fb from './providers/apiFootball.js';
import { settlePick, isFinal, isVoidState } from './engine/settle.js';
import { apiCalls } from './http.js';

const [run] = await db.insertRun([{ kind: 'settle' }]);
try {
  if (!fb.available()) throw new Error('API_FOOTBALL_KEY missing');
  const cutoff = new Date(Date.now() - 2.5 * 3600e3).toISOString();
  const pending = await db.select('picks', `result=eq.PENDING&is_demo=eq.false&kickoff=lt.${cutoff}&select=id,fixture_id,market_id,odds`);
  const ids = [...new Set(pending.map(p => p.fixture_id))];
  const fixtures = ids.length ? await fb.fixturesByIds(ids) : [];
  const byId = new Map(fixtures.map(f => [f.id, f]));
  let settled = 0;
  for (const f of fixtures) await db.patch('fixtures', `id=eq.${f.id}`, { status: f.status, home_goals: f.homeGoals, away_goals: f.awayGoals, updated_at: new Date().toISOString() });
  for (const p of pending) {
    const f = byId.get(p.fixture_id); if (!f) continue;
    const now = new Date().toISOString();
    if (isFinal(f.status) && f.homeGoals != null) {
      const r = settlePick(p.market_id, Number(p.odds), f.homeGoals, f.awayGoals);
      await db.patch('picks', `id=eq.${p.id}`, { result: r.status, profit: r.profit, home_goals: f.homeGoals, away_goals: f.awayGoals, settled_at: now }); settled++;
    } else if (isVoidState(f.status)) {
      await db.patch('picks', `id=eq.${p.id}`, { result: 'VOID', profit: 0, settled_at: now }); settled++;
    }
  }
  await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: true, message: `settled ${settled} of ${pending.length} pending`, api_calls: apiCalls() });
  console.log(`settled ${settled}/${pending.length}`);
} catch (e) {
  await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: false, message: String(e.message).slice(0, 500) });
  console.error(e.message); process.exitCode = 1;
}
