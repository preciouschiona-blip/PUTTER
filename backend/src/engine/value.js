// Odds maths, value, grading.
export const implied = odds => 1 / odds;

/** Proportional de-vig of a full set of mutually exclusive outcome odds. */
export function devig(oddsList) {
  const inv = oddsList.map(o => 1 / o);
  const book = inv.reduce((a, b) => a + b, 0);
  return { fair: inv.map(x => x / book), margin: book - 1 };
}

/** EV per 1 unit staked. A push returns the stake (counts as zero). */
export const expectedValue = (pWin, pPush, odds) => pWin * (odds - 1) - (1 - pWin - pPush);

export const DEFAULT_CONFIG = {
  min_odds: 2.0,
  green_min_ev: 0.05,
  amber_min_ev: 0.02,
  green_min_quality: 0.6,
  green_max_model_spread: 0.08,
  max_edge_vs_market: 0.2, // raw model vs de-vigged market gap above this is treated as suspect
  max_market_weight_model: 0.5, // cap on how much the model may override the market
  min_pick_lead_minutes: 10,
  max_fixtures_per_run: 25,
  lookahead_days: 2,
};

/**
 * Blend model and market. The market is a strong prior, so the model's weight is capped
 * and shrinks with low data quality and with disagreement between models.
 */
export function blendProbability(pModel, pMarketFair, quality, spread, cfg = DEFAULT_CONFIG) {
  let w = cfg.max_market_weight_model * Math.min(1, Math.max(0, quality));
  w *= Math.max(0.3, 1 - 4 * spread);
  const p = pMarketFair == null ? pModel : w * pModel + (1 - w) * pMarketFair;
  return { p, w };
}

/**
 * Grade a candidate selection.
 * input: { odds, pModel, pPush, pMarketFair|null, quality, spread, modelSd, oddsVerified }
 */
export function evaluateSelection(input, cfg = DEFAULT_CONFIG) {
  const { odds, pModel, pPush = 0, pMarketFair = null, quality, spread, modelSd = 0.03, oddsVerified = true } = input;
  const { p: pAdj, w } = blendProbability(pModel, pMarketFair, quality, spread, cfg);
  const evRaw = expectedValue(pModel, pPush, odds);
  const evAdj = expectedValue(pAdj, pPush, odds);
  const pLow = Math.max(0, pAdj - 1.0 * modelSd);
  const evLow = expectedValue(pLow, pPush, odds);
  const edgeVsMarket = pMarketFair == null ? null : pModel - pMarketFair;
  const reasons = [];
  let grade = 'RED';

  if (!oddsVerified) reasons.push('Odds not verified from a live bookmaker feed');
  if (odds < cfg.min_odds) reasons.push(`Odds below minimum ${cfg.min_odds.toFixed(2)}`);
  const eligible = oddsVerified && odds >= cfg.min_odds;

  if (eligible && evAdj >= cfg.amber_min_ev) {
    grade = 'AMBER';
    const greenOk =
      evAdj >= cfg.green_min_ev && evLow > 0 && quality >= cfg.green_min_quality &&
      spread <= cfg.green_max_model_spread &&
      edgeVsMarket != null && Math.abs(edgeVsMarket) <= cfg.max_edge_vs_market;
    if (greenOk) grade = 'GREEN';
    else {
      if (evAdj < cfg.green_min_ev) reasons.push('Expected value below GREEN threshold');
      if (evLow <= 0) reasons.push('Value disappears under conservative probability');
      if (quality < cfg.green_min_quality) reasons.push('Limited data quality');
      if (spread > cfg.green_max_model_spread) reasons.push('Models disagree');
      if (edgeVsMarket == null) reasons.push('No market reference price to cross-check the model');
      else if (Math.abs(edgeVsMarket) > cfg.max_edge_vs_market) reasons.push('Model far from market; likely model error');
    }
  } else if (eligible) reasons.push('Insufficient expected value after uncertainty');

  const confidence = Math.round(100 * Math.max(0, Math.min(1, quality * (1 - 3 * spread))));
  return { grade, pAdj, evRaw, evAdj, evLow, edgeVsMarket, modelWeight: w, confidence, reasons };
}

/** Ranking score: quality of analysis, EV, reliability and confidence — never odds alone. */
export function rankScore(e, quality) {
  return 100 * (0.45 * Math.min(0.3, Math.max(0, e.evAdj)) / 0.3 + 0.3 * quality + 0.25 * e.confidence / 100);
}
