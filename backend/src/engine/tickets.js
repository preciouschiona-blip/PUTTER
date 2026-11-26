// Daily tickets: up to three multi-selection slips built from the published single picks.
// Rules: one leg per match inside a ticket; a match is reused in another ticket only when it is a "banker"
// (GREEN, high probability, high confidence) and at most one banker is shared between two tickets.
import { combine } from './accumulator.js';
import { familyOf } from './labels.js';

export const TICKET_DEFAULTS = {
  tickets_per_day: 3,
  banker_min_prob: 0.62,
  banker_min_confidence: 70,
  banker_max_tickets: 2,
  ticket_pool_size: 18,
  high_odds_target: 20,
};

export const SLOTS = [
  { slot: 1, name: 'Ticket 1 · Safest mix', strategy: 'safest', sizes: [3] },
  { slot: 2, name: 'Ticket 2 · Value mix', strategy: 'value', sizes: [3, 4] },
  { slot: 3, name: 'Ticket 3 · High odds', strategy: 'high', sizes: [4, 3] },
];

export const isBanker = (p, cfg = TICKET_DEFAULTS) =>
  p.grade === 'GREEN' && (p.p_adj ?? 0) >= cfg.banker_min_prob && (p.confidence ?? 0) >= cfg.banker_min_confidence;

function subsets(items, k) {
  const out = [];
  (function rec(start, chosen, fixtures) {
    if (chosen.length === k) { out.push(chosen.slice()); return; }
    for (let i = start; i < items.length; i++) {
      const it = items[i];
      if (fixtures.has(it.fixture_id)) continue;
      fixtures.add(it.fixture_id); chosen.push(it);
      rec(i + 1, chosen, fixtures);
      chosen.pop(); fixtures.delete(it.fixture_id);
    }
  })(0, [], new Set());
  return out;
}

const diversity = legs => new Set(legs.map(l => familyOf(l.market_id))).size / legs.length;

function evaluate(legs) {
  const c = combine(legs.map(l => ({ fixtureId: l.fixture_id, marketId: l.market_id, odds: Number(l.odds), p: l.p_adj ?? 1 / l.odds })));
  return { ...c, div: diversity(legs) };
}

/**
 * pool: pending published picks (GREEN/AMBER) of one data class (all demo or all real).
 * existing: tickets already published for the date [{slot, legs:[{fixture_id, market_id, ...}]}].
 * Returns new ticket objects for the missing slots only.
 */
export function buildTickets(pool, existing = [], cfg = {}, now = new Date()) {
  cfg = { ...TICKET_DEFAULTS, ...cfg };
  const minLead = (cfg.min_pick_lead_minutes ?? 10) * 60000;
  const items = pool
    .filter(p => (p.grade === 'GREEN' || p.grade === 'AMBER') && p.result === 'PENDING' && new Date(p.kickoff) - now > minLead && Number(p.odds) >= (cfg.min_odds ?? 2))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, cfg.ticket_pool_size);

  const used = new Map(); // fixture_id -> tickets using it
  for (const t of existing) for (const l of t.legs) used.set(l.fixture_id, (used.get(l.fixture_id) ?? 0) + 1);
  const have = new Set(existing.map(t => t.slot));
  const built = [];

  for (const def of SLOTS.slice(0, cfg.tickets_per_day)) {
    if (have.has(def.slot)) continue;
    let best = null;
    for (const size of def.sizes) {
      const cands = [];
      for (const legs of subsets(items, size)) {
        const shared = legs.filter(l => used.has(l.fixture_id));
        if (shared.length > 1) continue;
        if (shared.some(l => !isBanker(l, cfg) || used.get(l.fixture_id) >= cfg.banker_max_tickets)) continue;
        const ev = evaluate(legs);
        if (!(ev.ev > 0)) continue;
        cands.push({ legs, ev, shared });
      }
      if (!cands.length) continue;
      // prefer a real mix of market types (1X2 / goals / BTTS); fall back only when the pool cannot supply one
      const need = Math.min(3, new Set(items.map(i => familyOf(i.market_id))).size);
      const mixed = cands.filter(c => c.ev.div * size >= need - 1e-9);
      const use = mixed.length ? mixed : cands;
      let pick;
      if (def.strategy === 'safest') pick = max(use, c => c.ev.probability * (0.85 + 0.15 * c.ev.div));
      else if (def.strategy === 'value') pick = max(use, c => c.ev.ev * (0.85 + 0.15 * c.ev.div));
      else {
        const hi = use.filter(c => c.ev.combinedOdds >= cfg.high_odds_target);
        pick = hi.length ? max(hi, c => c.ev.probability * (0.85 + 0.15 * c.ev.div)) : max(use, c => c.ev.combinedOdds);
      }
      best = pick; break;
    }
    if (!best) continue;
    for (const l of best.legs) used.set(l.fixture_id, (used.get(l.fixture_id) ?? 0) + 1);
    const times = best.legs.map(l => new Date(l.kickoff).getTime());
    const allGreen = best.legs.every(l => l.grade === 'GREEN');
    const e = best.ev;
    built.push({
      slot: def.slot, name: def.name, strategy: def.strategy,
      grade: allGreen ? 'GREEN' : 'AMBER',
      legs: best.legs.map(l => ({
        pick_id: l.id ?? null, fixture_id: l.fixture_id, kickoff: l.kickoff, league: l.league, home_team: l.home_team, away_team: l.away_team,
        market_id: l.market_id, market_label: l.market_label, selection_label: l.selection_label, odds: Number(l.odds), p: l.p_adj,
        grade: l.grade, bookmaker: l.bookmaker ?? null, banker: isBanker(l, cfg),
      })),
      combined_odds: +e.combinedOdds.toFixed(3), probability: +e.probability.toFixed(4), ev: +e.ev.toFixed(4), risk: e.risk,
      first_kickoff: new Date(Math.min(...times)).toISOString(), last_kickoff: new Date(Math.max(...times)).toISOString(),
      note: best.shared.length ? `Reuses ${best.shared[0].home_team} v ${best.shared[0].away_team} because it is one of the strongest selections of the day (still not guaranteed).` : null,
      is_demo: best.legs.some(l => l.is_demo),
    });
  }
  return built;
}

function max(list, f) { let b = list[0], bv = f(b); for (const x of list) { const v = f(x); if (v > bv) { b = x; bv = v; } } return b; }

/** legResults: array of 'PENDING'|'WON'|'LOST'|'VOID' aligned with legOdds. Flat 1 unit stake. */
export function settleTicket(legResults, legOdds) {
  if (legResults.includes('LOST')) return { result: 'LOST', profit: -1 };
  if (legResults.includes('PENDING')) return { result: 'PENDING', profit: null };
  const won = legResults.map((r, i) => (r === 'WON' ? legOdds[i] : null)).filter(Boolean);
  if (!won.length) return { result: 'VOID', profit: 0 };
  return { result: 'WON', profit: +(won.reduce((a, b) => a * b, 1) - 1).toFixed(4) };
}
