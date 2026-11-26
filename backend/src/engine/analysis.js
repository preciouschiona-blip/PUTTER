import { predictMatch, marketView } from './model.js';
import { devig, evaluateSelection, rankScore, DEFAULT_CONFIG } from './value.js';
import { marketLabel, familyOf } from './labels.js';
import { roundMatrix } from './poisson.js';

const pct = x => `${Math.round(x * 100)}%`;
const last = (ms, n) => ms.slice(0, n);
function formLine(ms, n = 5) {
  const l = last(ms, n); if (!l.length) return 'n/a';
  const w = l.filter(m => m.gf > m.ga).length, d = l.filter(m => m.gf === m.ga).length;
  return `${w}W ${d}D ${l.length - w - d}L, ${(l.reduce((s, m) => s + m.gf, 0) / l.length).toFixed(1)} scored / ${(l.reduce((s, m) => s + m.ga, 0) / l.length).toFixed(1)} conceded per game`;
}

/**
 * bundle: { fixture:{id,kickoff,league,home,away,isCup?}, home:{matches,injuries}, away:{...},
 *           odds:{ selections:{[id]:{best,bookmaker,updated,avg,count}}, groups:[[ids]] }|null, flags, leagueAvg? }
 */
export function analyseFixture(bundle, cfg = DEFAULT_CONFIG) {
  const { fixture, odds } = bundle;
  const bookmakers = odds ? Math.max(0, ...Object.values(odds.selections).map(s => s.count ?? 0)) : 0;
  const pred = predictMatch({ id: fixture.id, home: bundle.home, away: bundle.away, leagueAvg: bundle.leagueAvg, flags: { ...bundle.flags, bookmakers } });
  if (!pred.ok) return { analysis: { fixtureId: fixture.id, status: 'skipped', reason: pred.reason }, picks: [] };

  const fairByGroup = new Map();
  if (odds) for (const g of odds.groups) {
    const avgs = g.map(id => odds.selections[id]?.avg);
    if (avgs.every(Boolean)) { const { fair } = devig(avgs); g.forEach((id, i) => fairByGroup.set(id, fair[i])); }
  }

  // Double chance has no standalone de-vig; derive its fair price from the 1X2 fair prices.
  const fH = fairByGroup.get('1X2:H'), fD = fairByGroup.get('1X2:D'), fA = fairByGroup.get('1X2:A');
  if (fH != null) { fairByGroup.set('DC:1X', fH + fD); fairByGroup.set('DC:X2', fD + fA); fairByGroup.set('DC:12', fH + fA); }

  const candidates = [];
  if (odds) for (const [id, sel] of Object.entries(odds.selections)) {
    let view; try { view = marketView(pred, id); } catch { continue; }
    const ev = evaluateSelection({
      odds: sel.best, pModel: view.win, pPush: view.push, pMarketFair: fairByGroup.get(id) ?? null,
      quality: pred.quality, spread: view.spread, modelSd: 0.02 + 0.25 * view.spread + 0.1 / Math.sqrt(pred.sampleSize), oddsVerified: !bundle.isDemo,
    }, cfg);
    candidates.push({ id, sel, view, ev, score: rankScore(ev, pred.quality) });
  }
  candidates.sort((a, b) => b.score - a.score);

  const chosen = []; const used = new Set();
  for (const c of candidates) {
    if (c.ev.grade === 'RED') continue;
    const fam = familyOf(c.id);
    if (used.has(fam)) continue;
    used.add(fam); chosen.push(c);
    if (chosen.length >= 2) break;
  }

  const { home, away } = fixture;
  const hm = bundle.home.matches, am = bundle.away.matches;
  const picks = chosen.map(c => {
    const lab = marketLabel(c.id, home, away);
    const factors = [
      `${home} last 5: ${formLine(hm)}`,
      `${away} last 5: ${formLine(am)}`,
      `Expected goals (blend of 3 models): ${home} ${pred.lambdas.home.toFixed(2)} – ${pred.lambdas.away.toFixed(2)} ${away}`,
      `Model probability ${pct(c.view.win)}, market-implied ${c.ev.edgeVsMarket == null ? 'n/a' : pct(c.view.win - c.ev.edgeVsMarket)}, blended ${pct(c.ev.pAdj)}`,
    ];
    const risks = [...c.ev.reasons];
    if (fixture.isCup) risks.push('Cup tie: rotation and tactical caution can differ from league form');
    if (!bundle.flags?.injuriesChecked) risks.push('Injury/suspension data unavailable; team news not confirmed');
    for (const t of [bundle.home.injuries, bundle.away.injuries]) if (t?.questionable?.length) risks.push(`Doubtful: ${t.questionable.slice(0, 3).join(', ')}`);
    const keyPlayers = [...(bundle.home.injuries?.missing ?? []).map(n => `${home}: ${n} out`), ...(bundle.away.injuries?.missing ?? []).map(n => `${away}: ${n} out`)].slice(0, 6);
    return {
      fixture_id: String(fixture.id), kickoff: fixture.kickoff, league: fixture.league, home_team: home, away_team: away,
      market_id: c.id, market_label: lab.market, selection_label: lab.selection,
      odds: c.sel.best, bookmaker: c.sel.bookmaker, odds_updated: c.sel.updated,
      p_model: +c.view.win.toFixed(4), p_adj: +c.ev.pAdj.toFixed(4), implied_prob: +(1 / c.sel.best).toFixed(4),
      ev: +c.ev.evAdj.toFixed(4), confidence: c.ev.confidence, quality: +pred.quality.toFixed(3), grade: c.ev.grade,
      explanation: `${c.ev.grade === 'GREEN' ? 'Passes all value and reliability checks' : 'Shows value but with caveats'}: the three-model blend rates this at ${pct(c.ev.pAdj)} against a ${pct(1 / c.sel.best)} price (EV ${(c.ev.evAdj * 100).toFixed(1)}% per unit).`,
      key_players: keyPlayers, factors, risks, score: +c.score.toFixed(2), score_matrix: roundMatrix(pred.ensemble, 4),
      is_demo: !!bundle.isDemo,
    };
  });

  return {
    analysis: {
      fixtureId: fixture.id, status: 'analysed', quality: pred.quality, lambdas: pred.lambdas,
      candidates: candidates.length, qualified: picks.filter(p => p.grade === 'GREEN').length,
    },
    picks,
  };
}
