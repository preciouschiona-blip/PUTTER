// Poisson / Dixon-Coles scoreline model and market probability extraction.
export const MAX_GOALS = 7; // matrix is (MAX_GOALS+1)^2

export function pmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Dixon-Coles low-score correction factor.
function tau(x, y, lh, la, rho) {
  if (x === 0 && y === 0) return 1 - lh * la * rho;
  if (x === 0 && y === 1) return 1 + lh * rho;
  if (x === 1 && y === 0) return 1 + la * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/** Returns a normalised (MAX_GOALS+1)x(MAX_GOALS+1) matrix, m[home][away]. */
export function scoreMatrix(lh, la, rho = -0.06) {
  const n = MAX_GOALS + 1;
  const m = [];
  let total = 0;
  for (let h = 0; h < n; h++) {
    m.push([]);
    for (let a = 0; a < n; a++) {
      const p = Math.max(0, pmf(h, lh) * pmf(a, la) * tau(h, a, lh, la, rho));
      m[h].push(p);
      total += p;
    }
  }
  for (let h = 0; h < n; h++) for (let a = 0; a < n; a++) m[h][a] /= total;
  return m;
}

export function sumMatrix(m, pred) {
  let s = 0;
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m[h].length; a++) if (pred(h, a)) s += m[h][a];
  return s;
}

// ---- Market predicates. A market id looks like "OU:2.5:O". Each returns
// a function (homeGoals, awayGoals) => 'win' | 'push' | 'lose' ------------------
export function outcomeFn(marketId) {
  const [kind, a, b] = marketId.split(':');
  switch (kind) {
    case '1X2': return (h, g) => (a === 'H' ? h > g : a === 'D' ? h === g : h < g) ? 'win' : 'lose';
    case 'DC': return (h, g) => ((a === '1X' && h >= g) || (a === 'X2' && h <= g) || (a === '12' && h !== g)) ? 'win' : 'lose';
    case 'DNB': return (h, g) => (h === g ? 'push' : (a === 'H' ? h > g : h < g) ? 'win' : 'lose');
    case 'OU': {
      const line = parseFloat(a);
      return (h, g) => {
        const t = h + g;
        if (t === line) return 'push';
        return (b === 'O' ? t > line : t < line) ? 'win' : 'lose';
      };
    }
    case 'BTTS': return (h, g) => ((h > 0 && g > 0) === (a === 'Y')) ? 'win' : 'lose';
    case 'TTS': return (h, g) => ((a === 'H' ? h : g) > 0) ? 'win' : 'lose';
    case 'AH': { // AH:H:-1.5  (whole and half lines only)
      const line = parseFloat(b);
      return (h, g) => {
        const diff = (a === 'H' ? h - g : g - h) + line;
        return diff > 0 ? 'win' : diff === 0 ? 'push' : 'lose';
      };
    }
    default: throw new Error(`Unsupported market ${marketId}`);
  }
}

/** Probability of win / push from a matrix for a market id. */
export function marketProb(m, marketId) {
  const f = outcomeFn(marketId);
  let win = 0, push = 0;
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m[h].length; a++) {
    const r = f(h, a);
    if (r === 'win') win += m[h][a]; else if (r === 'push') push += m[h][a];
  }
  return { win, push, lose: 1 - win - push };
}

/** Probability that two legs on the SAME match both win (exact, from the matrix). */
export function jointWinProb(m, idA, idB) {
  const fa = outcomeFn(idA), fb = outcomeFn(idB);
  let s = 0;
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m[h].length; a++)
    if (fa(h, a) === 'win' && fb(h, a) === 'win') s += m[h][a];
  return s;
}

export const STANDARD_MARKETS = [
  '1X2:H', '1X2:D', '1X2:A', 'DC:1X', 'DC:X2', 'DC:12', 'DNB:H', 'DNB:A',
  'OU:1.5:O', 'OU:1.5:U', 'OU:2.5:O', 'OU:2.5:U', 'OU:3.5:O', 'OU:3.5:U',
  'BTTS:Y', 'BTTS:N', 'TTS:H', 'TTS:A',
];

export function allMarketProbs(m, extraIds = []) {
  const out = {};
  for (const id of new Set([...STANDARD_MARKETS, ...extraIds])) out[id] = marketProb(m, id);
  return out;
}

export function roundMatrix(m, d = 5) {
  const f = 10 ** d;
  return m.map(r => r.map(v => Math.round(v * f) / f));
}
