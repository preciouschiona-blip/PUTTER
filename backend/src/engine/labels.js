export function marketLabel(id, home, away) {
  const [k, a, b] = id.split(':');
  switch (k) {
    case '1X2': return { market: 'Match Winner (1X2)', selection: a === 'H' ? `${home} to win` : a === 'A' ? `${away} to win` : 'Draw' };
    case 'DC': return { market: 'Double Chance', selection: a === '1X' ? `${home} or Draw` : a === 'X2' ? `Draw or ${away}` : `${home} or ${away}` };
    case 'DNB': return { market: 'Draw No Bet', selection: a === 'H' ? home : away };
    case 'OU': return { market: `${b === 'O' ? 'Over' : 'Under'} ${a} Goals`, selection: `${b === 'O' ? 'Over' : 'Under'} ${a}` };
    case 'BTTS': return { market: 'Both Teams To Score', selection: a === 'Y' ? 'Yes' : 'No' };
    case 'TTS': return { market: 'Team To Score', selection: `${a === 'H' ? home : away} to score` };
    case 'AH': return { market: 'Asian Handicap', selection: `${a === 'H' ? home : away} ${parseFloat(b) > 0 ? '+' : ''}${b}` };
    default: return { market: id, selection: id };
  }
}
export const familyOf = id => { const k = id.split(':')[0]; return k === 'DC' || k === 'DNB' ? '1X2' : k === 'TTS' ? 'BTTS' : k; };
