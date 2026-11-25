const teams = {
  'Gen.G': 'LCK', 'T1': 'LCK', 'Hanwha Life Esports': 'LCK', 'Dplus KIA': 'LCK',
  'Bilibili Gaming': 'LPL', 'Invictus Gaming': 'LPL', 'Top Esports': 'LPL', 'Anyone s Legend': 'LPL',
  'G2 Esports': 'LEC', 'Karmine Corp': 'LEC', 'Movistar KOI': 'LEC',
  'CTBC Flying Oyster': 'LCP', 'Team Secret Whales': 'LCP',
  'Team Liquid': 'LCS', 'LYON': 'LCS', 'Los Grandes': 'CBLOL',
};
const label = name => name === 'Anyone s Legend' ? "Anyone’s Legend" : name;
const scope = document.getElementById('worlds-scope');

function display(id, headers, rows) {
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const name of headers) {
    const th = document.createElement('th');
    th.scope = 'col'; th.textContent = name; head.append(th);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  document.getElementById(id).replaceChildren(table);
}

try {
  const response = await fetch('./worlds-2026-series.json');
  if (!response.ok) throw new Error('賽果無法載入');
  const games = await response.json();
  const totals = new Map();
  let count = 0;
  for (const [, , left, a, b, right] of games) {
    count += a + b;
    const l = teams[left], r = teams[right];
    if (!l || !r || l === r) continue;
    const [first, second] = [l, r].sort();
    const key = first + '/' + second;
    if (!totals.has(key)) totals.set(key, [first, second, 0, 0, 0]);
    const row = totals.get(key);
    row[2]++;
    row[3] += first === l ? a : b;
    row[4] += first === l ? b : a;
  }
  scope.textContent = games.length + ' 個系列賽 · ' + count + ' 局 · 2026-10-23 至 11-14 · 16.20';
  display('worlds-cross', ['賽區 A','賽區 B','系列賽','A 勝局','B 勝局','A 勝率'],
    [...totals.values()].sort((a,b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
      .map(row => [...row, (100 * row[3] / (row[3] + row[4])).toFixed(1) + '%']));
  display('worlds-series', ['日期','階段','隊伍','比分','隊伍','版本'],
    games.map(([day, stage, left, a, b, right, version]) => [day, stage, label(left), a + '–' + b, label(right), version]));
} catch { scope.textContent = '無法載入世界賽賽果'; }
