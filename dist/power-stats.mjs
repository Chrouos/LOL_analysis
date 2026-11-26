export function rankTeams(teams, profiles) {
  return teams.map(([name, elo, date, lineup]) => {
    const values = lineup.flatMap(index => profiles[index][5]);
    const roster = values.length === 30 && values.every(Number.isFinite)
      ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const lower = teams.filter(row => row[1] < elo).length;
    const tied = teams.filter(row => row[1] === elo).length;
    const eloPercentile = 100 * (lower + .5 * tied) / teams.length;
    const score = roster === null ? null : .7 * eloPercentile + .3 * roster;
    return {name, elo, date, lineup, roster, score, eloPercentile};
  }).sort((a,b) => (b.score ?? -1) - (a.score ?? -1) || b.elo - a.elo);
}

export function comparableStints(profiles, current) {
  return profiles.map((row, index) => [row,index])
    .filter(([row]) => row[2] === current[2] && row[1] === current[1] && row[0] !== current[0])
    .sort(([a],[b]) => b[3] - a[3]);
}
