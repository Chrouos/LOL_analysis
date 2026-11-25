const el = id => document.getElementById(id);
const venues = {LCK: 'LCK', LPL: 'LPL', WLDs: '世界賽'};
const targets = {firstdragon: '首條小龍', firstherald: '首預示者', firstbaron: '首巴龍', result: '單局勝負'};
const roles = {top: '上路', jng: '打野', mid: '中路', bot: '下路', sup: '輔助'};
const pct = value => (100 * value).toFixed(1) + '%';
const rate = (n, total) => total ? pct(n / total) + ' · ' + n + '/' + total : '—';

function table(id, headers, rows) {
  if (!el(id)) return;
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
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option('全部', ''), ...[...new Set(values)].sort().map(value => new Option(value, value)));
  if (values.includes(previous)) select.value = previous;
}

function draw(id, groups) {
  const container = el(id);
  if (!container) return;
  container.replaceChildren();
  for (const [title, bars] of groups) {
    const group = document.createElement('div');
    group.className = 'chart-item';
    const heading = document.createElement('strong');
    heading.textContent = title;
    group.append(heading);
    for (const [label, n, total] of bars) {
      const row = document.createElement('div');
      row.className = 'chart-bar';
      const caption = document.createElement('span');
      caption.textContent = label;
      const track = document.createElement('div');
      track.className = 'chart-track';
      track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.style.width = total ? pct(n / total) : '0%';
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'chart-value';
      value.textContent = total ? pct(n / total) : '—';
      value.title = total ? n + '/' + total : '缺資料';
      row.append(caption, track, value);
      group.append(row);
    }
    container.append(group);
  }
  if (!groups.length) container.textContent = '沒有符合條件的資料';
}

const portraits = {'T1/Faker': 'faker', 'Gen.G/Chovy': 'chovy', 'Bilibili Gaming/Knight': 'knight'};

function showProfile(row) {
  const profile = el('player-profile');
  profile.replaceChildren();
  if (!row) return;
  const card = document.createElement('div');
  card.className = 'player-card';
  const frame = document.createElement('div');
  frame.className = 'portrait-frame';
  const initials = document.createElement('span');
  initials.textContent = row[3].slice(0, 2).toUpperCase();
  initials.setAttribute('aria-hidden', 'true');
  frame.append(initials);
  const asset = portraits[row[2] + '/' + row[3]];
  if (asset) {
    const img = document.createElement('img');
    img.alt = row[3] + ' 選手照';
    img.onerror = () => img.remove();
    img.src = './assets/players/' + asset + '.webp';
    frame.append(img);
  }
  const name = document.createElement('h3');
  name.textContent = row[3];
  const details = document.createElement('p');
  details.textContent = row[2] + ' · ' + roles[row[4]] + ' · ' + row[5] + ' 局';
  card.append(frame, name, details);
  profile.append(card);
}

function charts(data, includesTeam, query) {
  const select = el('chart-player');
  if (select) {
    const players = data.players.filter(row => includesTeam(row) && row[3].toLowerCase().includes(query));
    const prior = select.value;
    const key = row => JSON.stringify(row.slice(0, 5));
    select.replaceChildren(...players.map(row => new Option(row[3] + ' · ' + row[2] + ' · ' + venues[row[0]] + ' · ' + roles[row[4]], key(row))));
    const chosen = players.find(row => key(row) === prior) ?? players.find(row => row[3] === 'Faker' && row[0] === 'LCK') ?? players[0];
    if (chosen) select.value = key(chosen);
    select.disabled = !chosen;
    const showPlayer = () => {
      const row = players.find(player => key(player) === select.value);
      showProfile(row);
      draw('player-chart', row ? [['使用率前八名', row[6].slice(0, 8).map(([hero, n]) => [hero, n, row[5]])]] : []);
    };
    select.onchange = showPlayer;
    showPlayer();
  }
  draw('team-chart', data.teams.filter(includesTeam).sort((a, b) => b[3].games - a[3].games).slice(0, 3)
    .map(([venue, , team, counts]) => [team + ' · ' + venues[venue] + ' · ' + counts.games + ' 局',
      ['result', 'firstdragon', 'firstherald', 'firstbaron'].map(target =>
        [target === 'result' ? '勝率' : targets[target], counts[target], counts[target + '_n']])]));

}

function setupObjectiveComparison(observed) {
  const buttons = [...document.querySelectorAll('[data-objective]')];
  const show = target => {
    const container = el('objective-comparison');
    if (!container) return;
    container.replaceChildren();
    const splits = new Map();
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.objective === target));
    for (const [venue, name] of Object.entries(venues)) {
      const [, , counts] = observed.find(row => row[0] === venue && row[1] === target);
      const [blue, red, none, missing] = counts;
      const total = blue + red + none;
      splits.set(venue, {total, blue, red, none});
      const group = document.createElement('div');
      group.className = 'split-group';
      const title = document.createElement('div');
      title.className = 'split-title';
      const label = document.createElement('strong');
      label.textContent = name;
      const samples = document.createElement('span');
      samples.textContent = total + ' 局有效' + (missing ? ' · ' + missing + ' 局缺資料' : '');
      title.append(label, samples);
      group.append(title);
      if (total) {
        const bar = document.createElement('div');
        bar.className = 'split';
        bar.setAttribute('aria-hidden', 'true');
        const labels = document.createElement('div');
        labels.className = 'split-labels';
        for (const [css, side, n] of [['blue', '藍方', blue], ['red', '紅方', red], ['none', '無人取得', none]]) {
          const segment = document.createElement('span');
          segment.className = css;
          segment.style.width = 100 * n / total + '%';
          bar.append(segment);
          const detail = document.createElement('span');
          detail.textContent = side + ' ' + pct(n / total) + '（' + n + '/' + total + '）';
          labels.append(detail);
        }
        group.append(bar, labels);
      }
      container.append(group);
    }
    const lck = splits.get('LCK');
    const lpl = splits.get('LPL');
    const difference = document.createElement('p');
    difference.className = 'difference';
    if (lck.total && lpl.total) {
      const delta = side => {
        const n = 100 * (lck[side] / lck.total - lpl[side] / lpl.total);
        return (n > 0 ? '+' : '') + n.toFixed(1) + ' 個百分點';
      };
      difference.textContent = 'LCK 相對 LPL · 藍方 ' + delta('blue') + ' ／ 紅方 ' + delta('red') + ' ／ 無人取得 ' + delta('none');
    } else difference.textContent = 'LCK 與 LPL 差值 · 缺資料';
    container.append(difference);
  };
  for (const button of buttons) button.onclick = () => show(button.dataset.objective);
  show('firstdragon');
}

function render(data) {
  const venue = el('venue').value;
  const region = (el('region')?.value ?? '');
  const team = (el('team')?.value ?? '');
  const query = (el('player')?.value ?? '').trim().toLowerCase();
  const includesVenue = key => !venue || venue === key;
  const includesTeam = ([v, r, t]) => includesVenue(v) && (!region || region === r) && (!team || team === t);
  charts(data, includesTeam, query);
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
  if (el('cross-section')) el('cross-section').hidden = !includesVenue('WLDs');
  table('cross', ['賽區 A', '賽區 B', '項目', 'A 取得／獲勝', 'B 取得／獲勝', '無人取得', '缺資料'],
    data.cross.filter(([a, b]) => !region || a === region || b === region)
      .map(([a, b, target, counts, none, missing]) => [a, b, targets[target], a === b ? counts[0] + '（同賽區合計）' : counts[0], counts[1] ?? '—', none, missing]));
}

try {
  const response = await fetch('./dashboard.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  setupObjectiveComparison(data.observed);
  el('status').textContent = '';
  function updateOptions() {
    const venue = el('venue').value;
    const rows = data.teams.filter(([v]) => !venue || v === venue);
    options('region', rows.map(row => row[1]));
    const region = (el('region')?.value ?? '');
    options('team', rows.filter(row => !region || row[1] === region).map(row => row[2]));
    render(data);
  }
  el('venue').onchange = updateOptions;
  if (el('region')) el('region').onchange = updateOptions;
  if (el('team')) el('team').onchange = () => render(data);
  if (el('player')) el('player').oninput = () => render(data);
  updateOptions();
} catch {
  el('status').textContent = '無法載入賽事資料';
}
