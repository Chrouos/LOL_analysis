function increment(map, key, wins) {
  const row = map.get(key) ?? [0, 0];
  row[0]++;
  row[1] += wins;
  map.set(key, row);
}

export function duels(games, {role, hero, player, opponent}) {
  const results = new Map();
  for (const [, , , , blueWin, picks] of games) {
    for (const side of [0, 1]) {
      const own = picks[side * 5 + role], enemy = picks[(1 - side) * 5 + role];
      if (!own || !enemy || own[1] !== hero || own[1] === enemy[1] || (player >= 0 && own[0] !== player) ||
          (opponent >= 0 && enemy[1] !== opponent)) continue;
      increment(results, enemy[1], Number(side === 0 ? blueWin : !blueWin));
    }
  }
  return results;
}

export function playerPool(games, player) {
  const results = new Map();
  for (const [, , , , blueWin, picks] of games) {
    picks.forEach((pick, i) => {
      if (pick && pick[0] === player) increment(results, pick[1], Number(i < 5 ? blueWin : !blueWin));
    });
  }
  return results;
}

export function draftRates(games) {
  const byHero = new Map();
  let pickGames = 0, banGames = 0;
  for (const [, , , , , picks, bans] of games) {
    if (picks.every(Boolean)) {
      pickGames++;
      for (const hero of new Set(picks.map(pick => pick[1]))) {
        const counts = byHero.get(hero) ?? [0, 0];
        counts[0]++;
        byHero.set(hero, counts);
      }
    }
    if (bans) {
      banGames++;
      for (const hero of new Set(bans)) {
        const counts = byHero.get(hero) ?? [0, 0];
        counts[1]++;
        byHero.set(hero, counts);
      }
    }
  }
  return {byHero, pickGames, banGames};
}
