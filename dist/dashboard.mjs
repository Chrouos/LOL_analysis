import {renderTable as table} from './ui.mjs';
import {summarize} from './slices.mjs';
import {championIcons} from './champion-icons.mjs';

const el = id => document.getElementById(id);
const venues = {LCK: 'LCK', LPL: 'LPL', WLDs: '世界賽'};
const targets = {firstdragon: '首條小龍', firstherald: '首預示者', firstbaron: '首巴龍', result: '單局勝負'};
const roles = {top: '上路', jng: '打野', mid: '中路', bot: '下路', sup: '輔助'};
const pct = value => (100 * value).toFixed(1) + '%';
const rate = (n, total) => total ? pct(n / total) + ' · ' + n + '/' + total : '—';

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
    for (const [label, n, total, icon] of bars) {
      const row = document.createElement('div');
      row.className = 'chart-bar';
      const caption = document.createElement('span');
      caption.className = 'bar-caption';
      if (icon) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        img.width = img.height = 32;
        img.onerror = () => img.remove();
        caption.append(img);
      }
      const captionText = document.createElement('span');
      captionText.textContent = label;
      caption.append(captionText);
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

const portraits = {'T1/Faker': 'faker', 'T1/Keria': 'keria', 'Gen.G/Chovy': 'chovy', 'Bilibili Gaming/Knight': 'knight'};

function avatar(row) {
  const frame = document.createElement('div');
  frame.className = 'portrait-frame';
  const initials = document.createElement('span');
  initials.textContent = row[3].slice(0, 2).toUpperCase();
  initials.setAttribute('aria-hidden', 'true');
  frame.append(initials);
  const asset = portraits[row[2] + '/' + row[3]];
  if (asset) {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    img.src = './assets/players/' + asset + '.webp';
    frame.append(img);
  }
  return frame;
}

function showProfile(row) {
  const profile = el('player-profile');
  profile.replaceChildren();
  if (!row) return;
  const card = document.createElement('div');
  card.className = 'player-card';
  const name = document.createElement('h3');
  name.textContent = row[3];
  const details = document.createElement('p');
  details.textContent = row[2] + ' · ' + roles[row[4]] + ' · ' + row[5] + ' 局';
  card.append(avatar(row), name, details);
  profile.append(card);
}

let selectedPlayer;
const playerKey = row => JSON.stringify(row.slice(0, 5));

function charts(data, includesTeam, query) {
  const picker = el('player-picker');
  if (picker) {
    const players = data.players.filter(row => includesTeam(row) && row[3].toLowerCase().includes(query));
    players.sort((a, b) => {
      const hasPhoto = row => Boolean(portraits[row[2] + '/' + row[3]]);
      return Number(hasPhoto(b)) - Number(hasPhoto(a)) || b[5] - a[5];
    });
    const chosen = players.find(row => playerKey(row) === selectedPlayer)
      ?? players.find(row => row[3] === 'Faker' && row[0] === 'LCK') ?? players[0];
    const cards = players.map(row => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'portrait-button';
      const name = document.createElement('strong');
      name.textContent = row[3];
      const context = document.createElement('small');
      context.textContent = row[2] + ' · ' + venues[row[0]] + ' · ' + roles[row[4]];
      button.append(avatar(row), name, context);
      button.onclick = () => select(row);
      return button;
    });
    picker.replaceChildren(...cards);
    function select(row) {
      const key = row && playerKey(row);
      if (key) selectedPlayer = key;
      cards.forEach((button, i) => button.setAttribute('aria-pressed', String(playerKey(players[i]) === key)));
      showProfile(row);
      table('player-hero-stats', ['英雄', '使用率', '選用後勝率', '平均 GD@15', 'GD@15 局數'],
        row ? row[6].map(([hero, n, wins, results, gold, available]) => [hero, rate(n, row[5]),
          rate(wins, results), available ? Math.round(gold / available) : '—', available]) : []);
      draw('player-chart', row ? [['使用率前八名', row[6].slice(0, 8).map(([hero, n]) => {
        const icon = championIcons[hero];
        return [hero, n, row[5], icon && 'https://ddragon.leagueoflegends.com/cdn/16.23.1/img/champion/' + icon];
      })]] : []);
    }
    select(chosen);
  }
  draw('team-chart', (data.teams ?? []).filter(includesTeam).sort((a, b) => b[3].games - a[3].games).slice(0, 3)
    .map(([venue, , team, counts]) => [team + ' · ' + venues[venue] + ' · ' + counts.games + ' 局',
      ['result', 'firstdragon', 'firstherald', 'firstbaron'].map(target =>
        [target === 'result' ? '勝率' : targets[target], counts[target], counts[target + '_n']])]));

}

let currentObjective = 'firstdragon';

function setupObjectiveComparison(observed) {
  const buttons = [...document.querySelectorAll('[data-objective]')];
  const show = target => {
    currentObjective = target;
    const container = el('objective-comparison');
    if (!container) return;
    container.replaceChildren();
    const splits = new Map();
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.objective === target));
    for (const [venue, name] of Object.entries(venues)) {
      const counts = observed.find(row => row[0] === venue && row[1] === target)?.[2] ?? [0, 0, 0, 0];
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
      samples.textContent = total || missing ? total + ' 局有效' + (missing ? ' · ' + missing + ' 局缺資料' : '') : '區間內無對局';
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
  show(currentObjective);
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
    (data.backtest ?? []).filter(([v]) => includesVenue(v)).map(([v, target, n, base, model]) =>
      [venues[v], targets[target], n, base ? pct(base[0]) : '—', model ? pct(model[0]) : '—',
        base ? base[1].toFixed(3) : '—', model ? model[1].toFixed(3) : '—']));
  table('observed', ['場域', '物件', '藍方', '紅方', '無人取得', '缺資料'],
    (data.observed ?? []).filter(([v, target]) => includesVenue(v) && target !== 'result').map(([v, target, [blue, red, none, missing]]) => {
      const total = blue + red + none;
      return [venues[v], targets[target], rate(blue, total), rate(red, total), rate(none, total), missing];
    }));
  table('teams', ['場域', '隊伍賽區', '隊伍', '局數', '勝率', '藍方勝率', '紅方勝率', '首條小龍', '首預示者', '首巴龍'],
    (data.teams ?? []).filter(includesTeam).map(([v, r, t, c]) => [venues[v], r, t, c.games,
      rate(c.result, c.result_n), rate(c.blue_wins ?? 0, c.blue), rate(c.red_wins ?? 0, c.red),
      ...['firstdragon', 'firstherald', 'firstbaron'].map(key => rate(c[key], c[key + '_n']))]));
  table('players', ['場域', '隊伍賽區', '隊伍', '選手', '位置', '局數', '英雄與使用率'],
    (data.players ?? []).filter(row => includesTeam(row) && row[3].toLowerCase().includes(query))
      .map(([v, r, t, p, role, n, picks]) => [venues[v], r, t, p, roles[role], n,
        (query ? picks : picks.slice(0, 5)).map(([hero, count]) => hero + ' ' + rate(count, n)).join(' ／ ')]));
  if (el('cross-section')) el('cross-section').hidden = !includesVenue('WLDs');
  table('cross', ['賽區 A', '賽區 B', '項目', 'A 取得／獲勝', 'B 取得／獲勝', '無人取得', '缺資料'],
    (data.cross ?? []).filter(([a, b]) => !region || a === region || b === region)
      .map(([a, b, target, counts, none, missing]) => [a, b, targets[target], a === b ? counts[0] + '（同賽區合計）' : counts[0], counts[1] ?? '—', none, missing]));
}

try {
  const seasonFile = () => el('season')?.value === '2025' ? './slices.json' : './slices-2026.json';
  const response = await fetch(el('patch') ? seasonFile() : el('backtest-season')?.value === '2026' ? './backtest-2026.json' : './dashboard.json');
  if (!response.ok) throw new Error('無法載入');
  let snapshot = await response.json();
  let data = el('patch') ? summarize(snapshot) : snapshot;
  el('status').textContent = '';
  function updateOptions() {
    const venue = el('venue').value;
    const rows = (data.teams ?? []).filter(([v]) => !venue || v === venue);
    options('region', rows.map(row => row[1]));
    const region = el('region')?.value ?? '';
    options('team', rows.filter(row => !region || row[1] === region).map(row => row[2]));
    render(data);
  }
  function applySlice() {
    const venue = el('venue').value;
    const eligible = snapshot.games.filter(row => !venue || row[2] === venue);
    options('patch', eligible.map(row => row[1]));
    el('patch').options[0].textContent = '全部版本';
    const patch = el('patch').value;
    const start = el('start-date').value;
    const end = el('end-date').value;
    data = summarize(snapshot, {start, end, patch});
    const filtered = eligible.filter(row => (!patch || row[1] === patch) && (!start || row[0] >= start) && (!end || row[0] <= end));
    const dates = filtered.length ? filtered[0][0] + ' 至 ' + filtered.at(-1)[0] : '沒有符合日期的對局';
    el('selected-scope').textContent = start && end && start > end ? '開始日須早於或等於結束日' :
      dates + ' · ' + filtered.length + ' 局 · ' + (patch ? '競賽版本 ' + patch : '全部版本');
    setupObjectiveComparison(data.observed);
    updateOptions();
  }
  el('venue').onchange = el('patch') ? applySlice : updateOptions;
  if (el('region')) el('region').onchange = updateOptions;
  if (el('team')) el('team').onchange = () => render(data);
  if (el('player')) el('player').oninput = () => render(data);
  if (el('patch')) {
    for (const id of ['patch', 'start-date', 'end-date']) el(id).onchange = applySlice;
    el('clear-dates').onclick = () => {
      for (const id of ['patch', 'start-date', 'end-date']) el(id).value = '';
      applySlice();
    };
    let request = 0;
    el('season').onchange = async () => {
      const current = ++request;
      el('status').textContent = '載入中';
      try {
        const next = await fetch(seasonFile());
        if (!next.ok) throw new Error('讀取失敗');
        const result = await next.json();
        if (current !== request) return;
        snapshot = result;
        for (const id of ['patch', 'start-date', 'end-date']) el(id).value = '';
        applySlice();
        el('status').textContent = '';
      } catch {
        if (current === request) el('status').textContent = '賽季資料載入失敗，目前顯示先前載入的資料';
      }
    };
    applySlice();
  } else {
    updateOptions();
    if (el('backtest-season')) el('backtest-season').onchange = async () => {
      const year = el('backtest-season').value;
      el('status').textContent = '載入中';
      try {
        const response = await fetch(year === '2026' ? './backtest-2026.json' : './dashboard.json');
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (year !== el('backtest-season').value) return;
        data = result;
        updateOptions();
        el('status').textContent = '';
      } catch {
        if (year === el('backtest-season').value) el('status').textContent = '無法載入該賽季回測';
      }
    };
  }
} catch {
  el('status').textContent = '無法載入賽事資料';
}
