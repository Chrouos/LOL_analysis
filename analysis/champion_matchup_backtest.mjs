// Run: node analysis/champion_matchup_backtest.mjs
// 2026 only. Historical residuals use a 21-day half-life, 0.5 per patch, and eight neutral pseudo-games.
import {readFileSync} from 'node:fs';
const s = JSON.parse(readFileSync(new URL('../dist/slices-2026.json', import.meta.url)));
console.log(JSON.stringify(evaluate(s), null, 2));

function evaluate(snapshot) {
  const elo = new Map(), history = new Map(), reports = new Map();
  const getElo = team => elo.get(team) ?? 0;
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  const record = (key, day, patch, residual) => {
    if (!history.has(key)) history.set(key, []);
    history.get(key).push([day, patch, residual]);
  };
  function effect(key, day, patch) {
    let sum = 0, count = 8;
    for (const [previousDay, previousPatch, residual] of history.get(key) ?? []) {
      if (previousPatch > patch) continue;
      const w = 2 ** (-(day - previousDay) / 21) * .5 ** (patch - previousPatch);
      sum += w * residual;
      count += w;
    }
    return sum / count;
  }
  for (let i = 0; i < snapshot.games.length;) {
    const date = snapshot.games[i][0];
    const day = Date.parse(date) / 86400000;
    const updates = [], shifts = new Map();
    while (snapshot.games[i]?.[0] === date) {
      const [, version, venue, blue, red, , , , winner, picks] = snapshot.games[i++];
      if (winner !== 0 && winner !== 1) continue;
      const patch = Number(version.split('.')[1]), y = Number(winner === 0);
      const z = Math.log(10) * (getElo(blue) - getElo(red)) / 400;
      const p = sigmoid(z), components = [0, 0, 0];
      const sides = [new Map(), new Map()];
      for (let j = 0; j < picks.length; j += 3) {
        const [position, player, hero] = picks.slice(j, j + 3);
        sides[Math.floor(position / 5)].set(position % 5, [player, hero]);
      }
      for (let role = 0; role < 5; role++) {
        if (!sides[0].has(role) || !sides[1].has(role)) continue;
        const [[bp, bh], [rp, rh]] = sides.map(side => side.get(role));
        const keys = [
          [[venue, role, 'hero', bh], [venue, role, 'hero', rh]],
          [[venue, role, 'playerHero', bp, bh], [venue, role, 'playerHero', rp, rh]],
          [[venue, role, 'matchup', bh, rh], [venue, role, 'matchup', rh, bh]],
        ];
        for (const [k, pair] of keys.entries()) {
          const [b, r] = pair.map(key => JSON.stringify(key));
          if (b === r) continue;
          components[k] += (effect(b, day, patch) - effect(r, day, patch)) / 5;
          updates.push([b, day, patch, y - p], [r, day, patch, p - y]);
        }
      }
      if (date >= '2026-04-01') {
        const models = [[0,0,0], [1,0,0], [0,1,0], [0,0,1], [1,1,0], [1,1,1]];
        for (const [index, weights] of models.entries()) {
          const prediction = sigmoid(z + weights.reduce((sum, w, k) => sum + w * components[k], 0));
          for (const group of ['合計', venue]) {
            const key = group + '/' + index;
            const row = reports.get(key) ?? [group,index,0,0,0];
            row[2]++;
            row[3] += Number(Number(prediction >= .5) === y);
            row[4] -= Math.log(y ? prediction : 1 - prediction);
            reports.set(key,row);
          }
        }
      }
      shifts.set(blue, (shifts.get(blue) ?? 0) + 24 * (y - p));
      shifts.set(red, (shifts.get(red) ?? 0) - 24 * (y - p));
    }
    for (const entry of updates) record(...entry);
    for (const [team, delta] of shifts) elo.set(team, getElo(team) + delta);
  }
  return [...reports.values()].map(([group,id,n,hit,loss]) => ({group,id,n,hit,logLoss:loss/n}));
}
