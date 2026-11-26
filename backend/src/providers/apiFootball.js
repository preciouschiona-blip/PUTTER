// API-Football (api-sports.io) v3 provider.
import { getJson } from '../http.js';

const BASE = 'https://v3.football.api-sports.io';
const key = () => process.env.API_FOOTBALL_KEY;
const cache = new Map();

async function call(path, params) {
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  if (cache.has(url)) return cache.get(url);
  const { json } = await getJson(url, { 'x-apisports-key': key() });
  if (json.errors && Object.keys(json.errors).length && !Array.isArray(json.errors)) throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  cache.set(url, json.response ?? []);
  return json.response ?? [];
}

export const available = () => !!key();

const toFixture = r => ({
  id: String(r.fixture.id), kickoff: r.fixture.date, status: r.fixture.status.short,
  league: r.league.name, leagueId: r.league.id, season: r.league.season, round: r.league.round ?? '',
  isCup: /cup|copa|coupe|pokal|knockout|final|round of|play-?off/i.test(`${r.league.name} ${r.league.round ?? ''}`),
  home: r.teams.home.name, away: r.teams.away.name, homeId: r.teams.home.id, awayId: r.teams.away.id,
  homeGoals: r.score?.fulltime?.home ?? null, awayGoals: r.score?.fulltime?.away ?? null,
});

export async function fixturesByDate(date) {
  return (await call('fixtures', { date })).map(toFixture).filter(f => f.status === 'NS' || f.status === 'TBD');
}
export async function fixturesByIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 20) out.push(...(await call('fixtures', { ids: ids.slice(i, i + 20).join('-') })).map(toFixture));
  return out;
}
/** Recent finished matches for a team from the team's own perspective, newest first. */
export async function teamForm(teamId, n = 15) {
  const rows = await call('fixtures', { team: teamId, last: n });
  return rows.filter(r => ['FT', 'AET', 'PEN'].includes(r.fixture.status.short) && r.score?.fulltime?.home != null)
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
    .map(r => {
      const home = r.teams.home.id === teamId;
      const gf = home ? r.score.fulltime.home : r.score.fulltime.away, ga = home ? r.score.fulltime.away : r.score.fulltime.home;
      return { date: r.fixture.date, venue: home ? 'H' : 'A', gf, ga, xgf: null, xga: null, league: r.league.name };
    });
}
export async function standings(leagueId, season) {
  try {
    const r = await call('standings', { league: leagueId, season });
    const table = r[0]?.league?.standings?.flat() ?? [];
    const map = new Map();
    for (const t of table) map.set(t.team.id, { rank: t.rank, points: t.points, played: t.all.played, gf: t.all.goals.for, ga: t.all.goals.against });
    return map;
  } catch { return new Map(); }
}
export async function topScorers(leagueId, season) {
  try {
    const [g, a] = await Promise.all([call('players/topscorers', { league: leagueId, season }), call('players/topassists', { league: leagueId, season })]);
    const f = (rows, field) => rows.map(r => ({ name: r.player.name, teamId: r.statistics[0]?.team?.id, value: r.statistics[0]?.goals?.[field] ?? 0 }));
    return { goals: f(g, 'total'), assists: f(a, 'assists') };
  } catch { return { goals: [], assists: [] }; }
}
/** Confirmed absentees ("Missing Fixture") vs doubtful players, split by team id. */
export async function injuries(fixtureId) {
  try {
    const rows = await call('injuries', { fixture: fixtureId });
    const out = new Map();
    for (const r of rows) {
      const e = out.get(r.team.id) ?? { missing: [], questionable: [] };
      (r.player.type === 'Missing Fixture' ? e.missing : e.questionable).push(r.player.name);
      out.set(r.team.id, e);
    }
    return { ok: true, byTeam: out };
  } catch { return { ok: false, byTeam: new Map() }; }
}

/** Turns absentees into attack-loss factors using the league's top scorers and assisters (documented heuristic). */
export function injuryImpact(teamId, inj, scorers, table) {
  const e = inj.byTeam.get(teamId) ?? { missing: [], questionable: [] };
  const teamGoals = table.get(teamId)?.gf;
  let loss = 0;
  for (const name of e.missing) {
    const g = scorers.goals.find(p => p.teamId === teamId && p.name === name)?.value ?? 0;
    const a = scorers.assists.find(p => p.teamId === teamId && p.name === name)?.value ?? 0;
    const base = teamGoals || Math.max(20, (g + a) * 4);
    loss += 0.55 * (g / base) + 0.2 * (a / base);
  }
  return { missing: e.missing, questionable: e.questionable, attackLoss: Math.min(0.25, loss), defenceLoss: 0 };
}
