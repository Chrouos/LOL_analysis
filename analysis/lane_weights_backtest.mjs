// Run: node analysis/lane_weights_backtest.mjs
import {readFileSync} from 'node:fs';

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function examples(snapshot) {
  const elo = new Map(), history = new Map(), output = [];
  const rating = team => elo.get(team) ?? 0;
  for (let i = 0; i < snapshot.games.length;) {
    const date = snapshot.games[i][0];
    const day = Date.parse(date) / 86400000;
    const updates = [], shifts = new Map();
    while (snapshot.games[i]?.[0] === date) {
      const [, version, venue, blue, red,,,, winner, picks] = snapshot.games[i++];
      if (winner !== 0 && winner !== 1) continue;
      const patch = Number(version.split('.')[1]), y = Number(winner === 0);
      const offset = Math.LN10 * (rating(blue) - rating(red)) / 400, p = sigmoid(offset);
      const lineup = Array(10).fill(null);
      for (let j = 0; j < picks.length; j += 3) lineup[picks[j]] = picks[j + 2];
      const inputs = Array(5).fill(0);
      for (let role = 0; role < 5; role++) {
        const b = lineup[role], r = lineup[role + 5];
        if (b === null || r === null || b === r) continue;
        const key = JSON.stringify([venue, role, Math.min(b,r), Math.max(b,r)]);
        const sign = b < r ? 1 : -1;
        let residualSum = 0, count = 8;
        for (const [oldDay, oldPatch, residual] of history.get(key) ?? []) {
          if (oldPatch > patch) continue;
          const w = 2 ** (-(day - oldDay) / 21) * .5 ** (patch - oldPatch);
          residualSum += w * residual;
          count += w;
        }
        inputs[role] = 2 * sign * residualSum / count;
        updates.push([key, [day, patch, sign * (y - p)]]);
      }
      output.push({date, venue, offset, y, inputs});
      shifts.set(blue, (shifts.get(blue) ?? 0) + 24 * (y - p));
      shifts.set(red, (shifts.get(red) ?? 0) - 24 * (y - p));
    }
    for (const [key, event] of updates) {
      if (!history.has(key)) history.set(key, []);
      history.get(key).push(event);
    }
    for (const [team, delta] of shifts) elo.set(team, rating(team) + delta);
  }
  return output;
}

function probability(row, weights) {
  return sigmoid(row.offset + row.inputs.reduce((sum, x, i) => sum + x * weights[i], 0));
}

function fit(rows) {
  // Minimize mean log loss + 0.001 / 2 * sum((weight - 0.2)^2).
  // Fixed Elo offset; coordinate Newton updates regularized toward equal weights.
  const weights = Array(5).fill(.2), ridge = .001;
  for (let sweep = 0; sweep < 100; sweep++) {
    let maxStep = 0;
    for (let i = 0; i < weights.length; i++) {
      let gradient = ridge * (weights[i] - .2), curvature = ridge;
      for (const row of rows) {
        const p = probability(row, weights), x = row.inputs[i];
        gradient += (p - row.y) * x / rows.length;
        curvature += p * (1 - p) * x * x / rows.length;
      }
      const step = gradient / curvature;
      weights[i] -= step;
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    if (maxStep < 1e-9) break;
  }
  return weights;
}

function evaluate(snapshot) {
  const rows = examples(snapshot);
  const train = rows.filter(row => row.date < '2026-04-01');
  const test = rows.filter(row => row.date >= '2026-04-01');
  const models = [
    ['Elo', Array(5).fill(0)], ['五路等權', Array(5).fill(.2)], ['五路個別權重', fit(train)],
  ];
  return {trainGames: train.length, testGames: test.length, through: test.at(-1).date,
    models: models.map(([model, weights]) => ({model, weights,
      results: ['合計','LCK','LPL'].map(venue => {
        const subset = test.filter(row => venue === '合計' || row.venue === venue);
        let correct = 0, loss = 0;
        for (const row of subset) {
          const p = probability(row, weights);
          correct += Number(Number(p >= .5) === row.y);
          loss -= Math.log(row.y ? p : 1 - p);
        }
        return {venue, games: subset.length, correct, logLoss: loss / subset.length};
      })}))};
}

const snapshot = JSON.parse(readFileSync(new URL('../dist/slices-2026.json', import.meta.url)));
console.log(JSON.stringify(evaluate(snapshot), null, 2));
