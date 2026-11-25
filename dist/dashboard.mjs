const el = id => document.getElementById(id);
const venues = {LCK: 'LCK', LPL: 'LPL', WLDs: '世界賽'};
const targets = {firstdragon: '首條小龍', firstherald: '首預示者', firstbaron: '首巴龍', result: '單局勝負'};
const roles = {top: '上路', jng: '打野', mid: '中路', bot: '下路', sup: '輔助'};
const pct = value => (100 * value).toFixed(1) + '%';
const rate = (n, total) => total ? pct(n / total) + ' · ' + n + '/' + total : '—';

function table(id, headers, rows) {
  const node = document.createElement('table');
  const head = node.createTHead().insertRow();
  for (const label of headers) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    head.append(th);
  }
  const body = node.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const value of row) tr.insertCell().textContent = value;
  }
  el(id).replaceChildren(node);
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = headers.length;
    cell.textContent = '沒有符合條件的資料';
  }
}

function options(id, values) {
  const select = el(id);
  const previous = select.value;
  select.replaceChildren(new Option('全部', ''), ...[...new Set(values)].sort().map(value => new Option(value, value)));
  if (values.includes(previous)) select.value = previous;
}

function render(data) {
  const venue = el('venue').value;
  const region = el('region').value;
  const team = el('team').value;
  const query = el('player').value.trim().toLowerCase();
  const includesVenue = key => !venue || venue === key;
  const includesTeam = ([v, r, t]) => includesVenue(v) && (!region || region === r) && (!team || team === t);
  table('backtest', ['場域', '預測項目', '局數', '基準正確率', '模型正確率', '基準 Log loss', '模型 Log loss'],
    data.backtest.filter(([v]) => includesVenue(v)).map(([v, target, n, base, model]) =>
      [venues[v], targets[target], n, base ? pct(base[0]) : '—', model ? pct(model[0]) : '—',
        base ? base[1].toFixed(3) : '—', model ? model[1].toFixed(3) : '—']));
  table('observed', ['場域', '物件', '藍方', '紅方', '無人取得', '缺資料'],
    data.observed.filter(([v, target]) => includesVenue(v) && target !== 'result').map(([v, target, [blue, red, none, missing]]) => {
      const total = blue + red + none;
      return [venues[v], targets[target], rate(blue, total), rate(red, total), rate(none, total), missing];
    }));
  table('teams', ['場域', '隊伍賽區', '隊伍', '局數', '勝率', '藍方勝率', '紅方勝率', '首條小龍', '首預示者', '首巴龍'],
    data.teams.filter(includesTeam).map(([v, r, t, c]) => [venues[v], r, t, c.games,
      rate(c.result, c.result_n), rate(c.blue_wins ?? 0, c.blue), rate(c.red_wins ?? 0, c.red),
      ...['firstdragon', 'firstherald', 'firstbaron'].map(key => rate(c[key], c[key + '_n']))]));
  table('players', ['場域', '隊伍賽區', '隊伍', '選手', '位置', '局數', '英雄與使用率'],
    data.players.filter(row => includesTeam(row) && row[3].toLowerCase().includes(query))
      .map(([v, r, t, p, role, n, picks]) => [venues[v], r, t, p, roles[role], n,
        (query ? picks : picks.slice(0, 5)).map(([hero, count]) => hero + ' ' + rate(count, n)).join(' ／ ')]));
  el('cross-section').hidden = !includesVenue('WLDs');
  table('cross', ['賽區 A', '賽區 B', '項目', 'A 取得／獲勝', 'B 取得／獲勝', '無人取得', '缺資料'],
    data.cross.filter(([a, b]) => !region || a === region || b === region)
      .map(([a, b, target, counts, none, missing]) => [a, b, targets[target], a === b ? counts[0] + '（同賽區合計）' : counts[0], counts[1] ?? '—', none, missing]));
}

try {
  const response = await fetch('./dashboard.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  el('status').textContent = '';
  function updateOptions() {
    const venue = el('venue').value;
    const rows = data.teams.filter(([v]) => !venue || v === venue);
    options('region', rows.map(row => row[1]));
    const region = el('region').value;
    options('team', rows.filter(row => !region || row[1] === region).map(row => row[2]));
    render(data);
  }
  el('venue').onchange = el('region').onchange = updateOptions;
  el('team').onchange = el('player').oninput = () => render(data);
  updateOptions();
} catch {
  el('status').textContent = '無法載入賽事資料';
}
