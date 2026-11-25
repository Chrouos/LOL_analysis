const targets = ['firstdragon', 'firstherald', 'firstbaron', 'result'];
const roles = ['top', 'jng', 'mid', 'bot', 'sup'];

function item(map, key, fallback) {
  if (!map.has(key)) map.set(key, fallback);
  return map.get(key);
}

export function summarize(snapshot, {start = '', end = '', patch = ''} = {}) {
  const observed = new Map(), teams = new Map(), players = new Map(), cross = new Map();
  let games = 0;
  for (const [date, version, venue, blue, red, dragon, herald, baron, win, picks, gold = {}] of snapshot.games) {
    if ((start && date < start) || (end && date > end) || (patch && patch !== version)) continue;
    games++;
    const outcomes = [dragon, herald, baron, win];
    const sides = [snapshot.teams[blue], snapshot.teams[red]];
    const regions = sides.map(team => snapshot.regions[team]);
    for (const [i, target] of targets.entries()) {
      const result = outcomes[i];
      const count = item(observed, venue + '/' + target, [venue, target, [0, 0, 0, 0]])[2];
      count[result < 0 ? 3 : result]++;
      if (venue === 'WLDs') {
        const [a, b] = [...regions].sort();
        const same = a === b;
        const row = item(cross, [a, b, target].join('/'), [a, b, target, same ? [0] : [0, 0], 0, 0]);
        if (result < 0) row[5]++;
        else if (result === 2) row[4]++;
        else row[3][same || regions[result] === a ? 0 : 1]++;
      }
    }
    for (const [side, team] of sides.entries()) {
      const counts = item(teams, venue + '/' + team, [venue, regions[side], team, {games: 0, blue: 0, red: 0, blue_wins: 0, red_wins: 0}])[3];
      counts.games++;
      counts[side === 0 ? 'blue' : 'red']++;
      if (win === side) counts[side === 0 ? 'blue_wins' : 'red_wins']++;
      for (const [i, target] of targets.entries()) {
        if (outcomes[i] < 0) continue;
        counts[target] = (counts[target] ?? 0) + Number(outcomes[i] === side);
        counts[target + '_n'] = (counts[target + '_n'] ?? 0) + 1;
      }
    }
    for (let i = 0; i < picks.length; i += 3) {
      const [position, playerId, heroId] = picks.slice(i, i + 3);
      const side = Math.floor(position / 5), role = roles[position % 5];
      const player = snapshot.players[playerId], hero = snapshot.heroes[heroId];
      const name = sides[side];
      const row = item(players, JSON.stringify([venue, name, player, role]), [venue, regions[side], name, player, role, 0, new Map()]);
      row[5]++;
      const stat = item(row[6], hero, [hero, 0, 0, 0, 0, 0]);
      stat[1]++;
      if (win >= 0 && win < 2) {
        stat[2] += Number(win === side);
        stat[3]++;
      }
      if (Number.isFinite(gold[position])) {
        stat[4] += gold[position];
        stat[5]++;
      }
    }
  }
  return {games, observed: [...observed.values()], teams: [...teams.values()].sort((a,b) => a[2].localeCompare(b[2])),
    players: [...players.values()].map(row => [...row.slice(0, 6), [...row[6].values()].sort((a,b) => b[1] - a[1])]),
    cross: [...cross.values()].sort((a,b) => a.join().localeCompare(b.join()))};
}
