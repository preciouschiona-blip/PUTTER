// Team form from cached finished matches (rows from the results_cache table), newest first.
export function formFromCache(rows, teamId, n = 15) {
  return rows
    .filter(r => r.home_id === teamId || r.away_id === teamId)
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))
    .slice(0, n)
    .map(r => {
      const home = r.home_id === teamId;
      return { date: r.kickoff, venue: home ? 'H' : 'A', gf: home ? r.home_goals : r.away_goals, ga: home ? r.away_goals : r.home_goals, xgf: null, xga: null, league: r.league };
    });
}
