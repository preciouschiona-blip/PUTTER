// Captures closing odds (price just before kickoff) for pending picks to measure closing line value.
import * as db from './db.js';
import * as oa from './providers/oddsApi.js';

const [run] = await db.insertRun([{ kind: 'closing' }]);
try {
  if (!oa.available()) throw new Error('ODDS_API_KEY missing');
  const soon = new Date(Date.now() + 35 * 60000).toISOString();
  const now = new Date().toISOString();
  const picks = await db.select('picks', `result=eq.PENDING&is_demo=eq.false&closing_odds=is.null&kickoff=gt.${now}&kickoff=lt.${soon}&select=id,market_id,sport_key,odds_event_id`);
  let n = 0;
  const bySport = new Map();
  for (const p of picks) { if (!p.sport_key) continue; (bySport.get(p.sport_key) ?? bySport.set(p.sport_key, []).get(p.sport_key)).push(p); }
  for (const [sk, list] of bySport) {
    const { events } = await oa.fetchOdds(sk);
    for (const p of list) {
      const ev = events.find(e => e.id === p.odds_event_id); if (!ev) continue;
      let sel = oa.summariseEvent(ev).selections[p.market_id];
      if (!sel) { const extra = await oa.fetchEventMarkets(sk, ev.id); if (extra) sel = oa.summariseEvent(ev, { ...extra, home_team: ev.home_team, away_team: ev.away_team }).selections[p.market_id]; }
      if (sel) { await db.patch('picks', `id=eq.${p.id}`, { closing_odds: sel.best }); n++; }
    }
  }
  await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: true, message: `closing odds for ${n}` });
  console.log(`closing odds captured: ${n}`);
} catch (e) {
  await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: false, message: String(e.message).slice(0, 500) });
  console.error(e.message); process.exitCode = 1;
}
