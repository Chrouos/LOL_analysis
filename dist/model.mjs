export const order = [
  0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1
];
export const isBan = slot => slot < 6 || (slot >= 12 && slot < 16);
export const sideAt = (slot, first) => order[slot] ^ first;
export const picks = actions => actions.filter((hero, slot) => hero && !isBan(slot));
export const locked = (history, actions) => new Set([...history.flatMap(picks), ...actions.filter(Boolean)]);

export function rank(games, heroes, excluded, slot, team, patch, date) {
  const eligible = games.filter(game => game.date < date && game.patch <= patch);
  const versions = [...new Set([...eligible.map(game => game.patch), patch])].sort((a, b) => a - b);
  const dateMs = Date.parse(date);
  const candidate = new Set(heroes.filter(hero => !excluded.has(hero)));
  const totals = new Map();
  for (const game of eligible) {
    const hero = game.actions[slot];
    if (!candidate.has(hero)) continue;
    const weight = 2 ** (-(dateMs - Date.parse(game.date)) / 86400000 / 30
      - (versions.length - 1 - versions.indexOf(game.patch)));
    const multiplier = game.teams[sideAt(slot, game.first)] === team ? 3 : 1;
    const entry = totals.get(hero) ?? {hero, score: .001, count: 0};
    entry.score += weight * multiplier;
    entry.count++;
    totals.set(hero, entry);
  }
  const total = [...totals.values()].reduce((sum, entry) => sum + entry.score, 0);
  return {games: eligible.length, ranks: [...totals.values()]
    .sort((a, b) => b.score - a.score)
    .map(entry => ({...entry, probability: entry.score / total}))};
}
