// Daily analysis pipeline: discover fixtures, fetch odds, analyse, publish qualified picks.
import * as db from './db.js';
import * as fb from './providers/apiFootball.js';
import * as oa from './providers/oddsApi.js';
import { matchScore } from './providers/teamMatch.js';
import { analyseFixture } from './engine/analysis.js';
import { DEFAULT_CONFIG } from './engine/value.js';
import { demoBundles } from './demo.js';
import { buildTickets } from './engine/tickets.js';
import { apiCalls } from './http.js';

const iso = d => d.toISOString().slice(0, 10);

async function loadConfig() {
  const rows = await db.select('config');
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    cfg: { ...DEFAULT_CONFIG, ...(m.settings ?? {}) },
    sportKeys: m.odds_sport_keys ?? [],
    leagues: new Set(m.leagues_enabled ?? []),
  };
}

function fixtureRow(f, extra = {}) {
  return { id: f.id, league: f.league, league_id: f.leagueId ?? null, home_team: f.home, away_team: f.away, kickoff: f.kickoff, status: f.status ?? 'NS', updated_at: new Date().toISOString(), ...extra };
}

export async function runPipeline({ demo = process.env.DEMO === '1' } = {}) {
  const [run] = await db.insertRun([{ kind: 'pipeline' }]);
  let seen = 0, analysed = 0, published = 0, msg = '';
  try {
    const { cfg, sportKeys, leagues } = await loadConfig();
    const now = new Date();
    const minKick = new Date(now.getTime() + cfg.min_pick_lead_minutes * 60000);
    const bundles = [];

    if (demo) {
      bundles.push(...demoBundles(now)); msg = 'DEMO MODE: synthetic data, clearly flagged';
    } else if (!fb.available() || !oa.available()) {
      throw new Error('API keys missing: set API_FOOTBALL_KEY and ODDS_API_KEY as GitHub secrets. No picks were generated.');
    } else {
      // 1. fixtures
      const fixtures = [];
      for (let d = 0; d <= cfg.lookahead_days; d++) fixtures.push(...await fb.fixturesByDate(iso(new Date(now.getTime() + d * 86400e3))));
      const upcoming = fixtures.filter(f => new Date(f.kickoff) > minKick && (leagues.size === 0 || leagues.has(f.leagueId)));
      seen = upcoming.length;
      // 2. odds
      const events = [];
      for (const sk of sportKeys) {
        try { const { events: evs } = await oa.fetchOdds(sk, 'h2h,totals', cfg.odds_regions); for (const e of evs) events.push({ ...e, sport_key: sk }); }
        catch (e) { console.warn(`::warning title=Odds fetch failed::${sk}: ${String(e.message).slice(0, 200)}`); }
      }
      // 3. match odds events to fixtures
      const matched = [], noOdds = [];
      for (const fx of upcoming) {
        let best = null, bs = 0;
        for (const ev of events) { const s = matchScore(fx, ev); if (s > bs) { bs = s; best = ev; } }
        (best ? matched : noOdds).push({ fx, ev: best });
      }
      // fixtures without bookmaker odds are not stored: they can never be recommended
      matched.sort((a, b) => new Date(a.fx.kickoff) - new Date(b.fx.kickoff));
      const batch = matched.slice(0, cfg.max_fixtures_per_run);
      await db.upsert('fixtures', matched.slice(cfg.max_fixtures_per_run).map(({ fx }) => fixtureRow(fx, { analysis_status: 'pending', analysis_note: 'Beyond this run\'s API budget' })), 'id');

      // 4. gather data and build bundles
      for (const { fx, ev } of batch) {
        try {
          const extra = cfg.odds_extra_markets ? await oa.fetchEventMarkets(ev.sport_key, ev.id, undefined, cfg.odds_regions) : null;
          const odds = oa.summariseEvent(ev, ...(extra ? [{ ...extra, home_team: ev.home_team, away_team: ev.away_team }] : []));
          const [hf, af, inj, table, scorers] = await Promise.all([fb.teamForm(fx.homeId, 15, fx.leagueId, fx.season), fb.teamForm(fx.awayId, 15, fx.leagueId, fx.season), fb.injuries(fx.id), fb.standings(fx.leagueId, fx.season), fb.topScorers(fx.leagueId, fx.season)]);
          bundles.push({
            fixture: { id: fx.id, kickoff: fx.kickoff, league: fx.league, home: fx.home, away: fx.away, isCup: fx.isCup },
            home: { matches: hf, injuries: fb.injuryImpact(fx.homeId, inj, scorers, table) },
            away: { matches: af, injuries: fb.injuryImpact(fx.awayId, inj, scorers, table) },
            flags: { hasStandings: table.size > 0, injuriesChecked: inj.ok }, odds,
            meta: { leagueId: fx.leagueId, sport_key: ev.sport_key, odds_event_id: ev.id },
          });
        } catch (e) {
          console.warn(`::warning title=Fixture skipped::${fx.home} v ${fx.away}: ${String(e.message).slice(0, 300)}`);
          await db.upsert('fixtures', [fixtureRow(fx, { analysis_status: 'skipped', analysis_note: `Data fetch failed: ${String(e.message).slice(0, 180)}` })], 'id');
        }
      }
    }

    // 5. analyse + publish
    for (const b of bundles) {
      const { analysis, picks } = analyseFixture(b, cfg);
      seen = demo ? seen + 1 : seen;
      if (analysis.status === 'analysed') analysed++;
      await db.upsert('fixtures', [fixtureRow(b.fixture, {
        league_id: b.meta?.leagueId ?? null, analysis_status: analysis.status, analysis_note: analysis.reason ?? null,
        quality: analysis.quality ?? null, exp_home: analysis.lambdas?.home ?? null, exp_away: analysis.lambdas?.away ?? null,
        candidates: analysis.candidates ?? 0, qualified: analysis.qualified ?? 0, is_demo: !!b.isDemo,
      })], 'id');
      const rows = picks.map(p => ({ ...p, sport_key: b.meta?.sport_key ?? null, odds_event_id: b.meta?.odds_event_id ?? null, score_matrix: p.score_matrix }));
      // insert-ignore: a pick already published for this fixture+market is never rewritten
      const inserted = await db.insertIgnore('picks', rows, 'fixture_id,market_id');
      published += inserted?.length ?? 0;
      // keep the latest price visible on existing picks without touching the published odds
      for (const p of picks) await db.patch('picks', `fixture_id=eq.${p.fixture_id}&market_id=eq.${encodeURIComponent(p.market_id)}&result=eq.PENDING`, { latest_odds: p.odds, latest_odds_at: new Date().toISOString() });
    }
    // 6. daily tickets built from the published picks (only missing slots are filled; published tickets never change)
    const day = iso(now);
    const horizon = new Date(now.getTime() + 36 * 3600e3).toISOString();
    const poolRows = await db.select('picks', `result=eq.PENDING&is_demo=eq.${demo}&kickoff=gt.${now.toISOString()}&kickoff=lt.${horizon}&select=*`);
    const existing = await db.select('tickets', `ticket_date=eq.${day}&is_demo=eq.${demo}&select=slot,legs`);
    const fresh = buildTickets(poolRows, existing, cfg, now);
    const tRows = fresh.map(t => ({ ...t, ticket_date: day, is_demo: demo }));
    if (tRows.length) await db.insertIgnore('tickets', tRows, 'ticket_date,slot,is_demo');
    msg = `${msg ? msg + '; ' : ''}tickets: ${existing.length + tRows.length}/3`;
    await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: true, fixtures_seen: seen, fixtures_analysed: analysed, picks_published: published, message: msg || 'OK', api_calls: apiCalls() });
    console.log(`pipeline ok: seen=${seen} analysed=${analysed} published=${published} calls=${apiCalls()}`);
  } catch (e) {
    await db.patchRun(run.id, { finished_at: new Date().toISOString(), ok: false, message: String(e.message).slice(0, 500), api_calls: apiCalls() });
    console.error(e.message); process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!db.dbReady()) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set'); process.exit(1); }
  await runPipeline();
}
