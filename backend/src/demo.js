// DEMONSTRATION DATA ONLY. Every row produced here is flagged is_demo=true and the app labels it clearly.
// Demo odds are synthetic, so demo selections are never graded GREEN and are excluded from track-record stats.
import { hashSeed, mulberry32 } from './engine/model.js';

const TEAMS = ['Demo Rovers', 'Sample United', 'Mock City', 'Test Athletic', 'Example Town', 'Placeholder FC', 'Sandbox Wanderers', 'Preview Albion'];

function form(rng, atk, def, n = 12) {
  return Array.from({ length: n }, (_, i) => ({ venue: i % 2 ? 'H' : 'A', gf: Math.max(0, Math.round(atk + (rng() - 0.5) * 3)), ga: Math.max(0, Math.round(def + (rng() - 0.5) * 3)) }));
}
export function demoBundles(now = new Date()) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const rng = mulberry32(hashSeed(`demo-${now.toISOString().slice(0, 10)}-${i}`));
    const home = TEAMS[(i * 2) % TEAMS.length], away = TEAMS[(i * 2 + 1) % TEAMS.length];
    const k = new Date(now.getTime() + (3 + i * 2) * 3600e3);
    const sel = (best, avg) => ({ best, avg, bookmaker: 'DEMO BOOK', updated: now.toISOString(), count: 5 });
    out.push({
      isDemo: true,
      fixture: { id: `demo-${now.toISOString().slice(0, 10)}-${i}`, kickoff: k.toISOString(), league: 'DEMO LEAGUE (not real)', home, away },
      home: { matches: form(rng, 1.8, 1.0), injuries: { missing: [], questionable: [], attackLoss: 0 } },
      away: { matches: form(rng, 1.1, 1.6), injuries: { missing: [], questionable: [], attackLoss: 0 } },
      flags: { hasStandings: false, injuriesChecked: false },
      odds: { selections: { '1X2:H': sel(2.1, 2.0), '1X2:D': sel(3.6, 3.4), '1X2:A': sel(3.9, 3.7), 'OU:2.5:O': sel(2.05, 1.95), 'OU:2.5:U': sel(1.85, 1.8) }, groups: [['1X2:H', '1X2:D', '1X2:A'], ['OU:2.5:O', 'OU:2.5:U']] },
    });
  }
  return out;
}
