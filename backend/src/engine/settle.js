import { outcomeFn } from './poisson.js';

/** Returns { status, profit } for a flat 1-unit stake. */
export function settlePick(marketId, odds, hg, ag) {
  const r = outcomeFn(marketId)(hg, ag);
  if (r === 'win') return { status: 'WON', profit: +(odds - 1).toFixed(4) };
  if (r === 'push') return { status: 'VOID', profit: 0 };
  return { status: 'LOST', profit: -1 };
}

const VOID_STATES = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP']);
const FINAL_STATES = new Set(['FT', 'AET', 'PEN']);
export const isFinal = s => FINAL_STATES.has(s);
export const isVoidState = s => VOID_STATES.has(s);
/** Goals for settlement are the 90-minute score; for AET/PEN the fulltime score from the provider is used. */
