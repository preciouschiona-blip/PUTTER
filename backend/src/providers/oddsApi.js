// The Odds API v4 provider. Produces best/average prices per selection id.
import { getJson } from '../http.js';

const BASE = 'https://api.the-odds-api.com/v4';
const key = () => process.env.ODDS_API_KEY;
export const available = () => !!key();

export async function activeSoccerSports() {
  const { json } = await getJson(`${BASE}/sports?apiKey=${key()}`);
  return json.filter(s => s.group === 'Soccer' && s.active).map(s => s.key);
}

export async function fetchOdds(sportKey, markets = 'h2h,totals') {
  const { json, headers } = await getJson(`${BASE}/sports/${sportKey}/odds?apiKey=${key()}&regions=eu,uk&markets=${markets}&oddsFormat=decimal&dateFormat=iso`);
  return { events: json, remaining: headers.get('x-requests-remaining') };
}
export async function fetchEventMarkets(sportKey, eventId, markets = 'btts,draw_no_bet,double_chance') {
  try {
    const { json } = await getJson(`${BASE}/sports/${sportKey}/events/${eventId}/odds?apiKey=${key()}&regions=eu,uk&markets=${markets}&oddsFormat=decimal&dateFormat=iso`);
    return json;
  } catch { return null; }
}

const LINES = new Set([1.5, 2.5, 3.5]);

function idFor(marketKey, outcome, ev) {
  const name = outcome.name, h = ev.home_team, a = ev.away_team;
  switch (marketKey) {
    case 'h2h': return name === h ? '1X2:H' : name === a ? '1X2:A' : /draw/i.test(name) ? '1X2:D' : null;
    case 'totals': return LINES.has(outcome.point) ? `OU:${outcome.point}:${/over/i.test(name) ? 'O' : 'U'}` : null;
    case 'btts': return `BTTS:${/yes/i.test(name) ? 'Y' : 'N'}`;
    case 'draw_no_bet': return name === h ? 'DNB:H' : name === a ? 'DNB:A' : null;
    case 'double_chance': {
      const hasD = /draw/i.test(name), hasH = name.includes(h), hasA = name.includes(a);
      return hasD && hasH ? 'DC:1X' : hasD && hasA ? 'DC:X2' : hasH && hasA ? 'DC:12' : null;
    }
    default: return null;
  }
}

/** Collapse an event (one or more payloads) into { selections, groups }. Best price + average across bookmakers. */
export function summariseEvent(...payloads) {
  const ev = payloads[0];
  const acc = new Map();
  for (const p of payloads) for (const bk of p?.bookmakers ?? []) for (const m of bk.markets ?? []) for (const o of m.outcomes ?? []) {
    const id = idFor(m.key, o, ev); if (!id || !(o.price > 1)) continue;
    const e = acc.get(id) ?? { prices: [], best: 0, bookmaker: null, updated: null };
    e.prices.push(o.price);
    if (o.price > e.best) { e.best = o.price; e.bookmaker = bk.title; e.updated = m.last_update ?? bk.last_update; }
    acc.set(id, e);
  }
  const selections = {};
  for (const [id, e] of acc) selections[id] = { best: e.best, avg: e.prices.reduce((s, x) => s + x, 0) / e.prices.length, bookmaker: e.bookmaker, updated: e.updated, count: e.prices.length };
  const want = [['1X2:H', '1X2:D', '1X2:A'], ['OU:1.5:O', 'OU:1.5:U'], ['OU:2.5:O', 'OU:2.5:U'], ['OU:3.5:O', 'OU:3.5:U'], ['BTTS:Y', 'BTTS:N'], ['DNB:H', 'DNB:A']];
  const groups = want.filter(g => g.every(id => selections[id]));
  // keep selections that are in a group (needed for de-vig) or are double chance (derived from 1X2)
  for (const id of Object.keys(selections)) if (!groups.some(g => g.includes(id)) && !id.startsWith('DC:')) delete selections[id];
  return { selections, groups };
}
