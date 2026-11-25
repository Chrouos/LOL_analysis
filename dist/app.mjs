import {order, isBan, sideAt, picks, locked, rank} from './model.mjs';

const el = id => document.getElementById(id);
const pct = value => (100 * value).toFixed(1) + '%';
const colors = ['blue', 'red'];
const sideNames = ['藍方', '紅方'];
let state = {actions: [], history: []};
let snapshot;

function fill(id, items) {
  el(id).replaceChildren(...items.map(([value, label]) => new Option(label, value)));
}
function append(tag, parent, text, className) {
  const child = document.createElement(tag);
  if (text !== undefined) child.textContent = text;
  if (className) child.className = className;
  parent.append(child);
  return child;
}
function cellRow(parent, cells) {
  const row = append('tr', parent);
  for (const cell of cells) append('td', row, cell);
}
function render() {
  const {games, heroes, version} = snapshot;
  const {actions, history} = state;
  const slot = actions.length;
  const complete = slot === order.length;
  const first = Number(el('first').value);
  const team = [el('blue').value, el('red').value];
  const side = sideAt(slot, first);
  const date = el('date').value;
  const patch = Number(el('patch').value);
  const blocked = locked(history.map(game => game.actions), actions);
  const query = el('search').value.trim().toLowerCase();
  const heroName = hero => heroes[hero]?.[0] ?? '略過';
  el('turn').textContent = complete ? '本局選角完成' : sideNames[side] + (isBan(slot) ? ' Ban' : ' Pick') + ' · ' + (slot + 1) + '/20';
  el('locks').textContent = '第 ' + (history.length + 1) + ' 局 · 無懼鎖定 ' + history.flatMap(game => picks(game.actions)).length + ' 名';
  el('next').disabled = !complete || history.length >= 4;
  el('skip').disabled = complete || !isBan(slot);
  el('undo').disabled = !actions.length && !history.length;
  el('first').disabled = Boolean(actions.length);
  el('blue').disabled = el('red').disabled = Boolean(actions.length || history.length);
  el('board').replaceChildren();
  for (const index of [0, 1]) {
    const column = append('div', el('board'));
    append('strong', column, sideNames[index] + ' ' + team[index], colors[index]);
    const list = append('ol', column);
    actions.forEach((hero, i) => {
      if (sideAt(i, first) === index) append('li', list, (isBan(i) ? 'Ban ' : 'Pick ') + heroName(hero));
    });
  }
  const forecast = el('forecast');
  forecast.replaceChildren();
  const {games: count, ranks} = rank(games, Object.keys(heroes), blocked, slot, team[side], patch, date);
  if (!ranks.length) append('p', forecast, complete ? '選角已完成' : '此手位缺少可用的歷史資料');
  for (const entry of ranks.slice(0, 5)) {
    const row = append('div', forecast, undefined, 'row');
    append('span', row, heroName(entry.hero));
    append('strong', row, pct(entry.probability));
    const bar = append('div', forecast, undefined, 'bar');
    append('span', bar).style.width = pct(entry.probability);
  }
  el('sample').textContent = count + ' 局歷史資料 · ' + ranks.length + ' 名有紀錄的合法候選';
  const pool = el('pool');
  pool.replaceChildren();
  for (const [hero, [name, roman, icon]] of Object.entries(heroes)) {
    if (query && !(name + ' ' + roman).toLowerCase().includes(query)) continue;
    const button = append('button', pool, undefined, 'hero');
    button.disabled = blocked.has(hero) || complete;
    const image = append('img', button);
    image.alt = '';
    image.loading = 'lazy';
    image.src = 'https://ddragon.leagueoflegends.com/cdn/' + version + '/img/champion/' + icon;
    append('span', button, name);
    if (blocked.has(hero)) append('small', button, actions.includes(hero) ? '本局' : '無懼');
    button.onclick = () => { actions.push(hero); render(); };
  }
  const selected = games.filter(game => game.date < date && game.patch === patch);
  const meta = new Map();
  const teams = new Map();
  for (const game of selected) {
    game.actions.forEach((hero, i) => {
      if (!heroes[hero]) return;
      const item = meta.get(hero) ?? {ban: 0, pick: 0, wins: 0};
      if (isBan(i)) item.ban++;
      else {
        item.pick++;
        item.wins += Number(sideAt(i, game.first) === game.winner);
      }
      meta.set(hero, item);
    });
    game.teams.forEach((name, i) => {
      const totals = teams.get(name) ?? [[0, 0], [0, 0]];
      totals[i][1]++;
      totals[i][0] += Number(i === game.winner);
      teams.set(name, totals);
    });
  }
  el('meta').replaceChildren();
  el('teams').replaceChildren();
  const ratio = (count, total) => total ? pct(count / total) + ' · ' + count + '/' + total : '—';
  for (const [hero, item] of [...meta].sort((a, b) => b[1].ban + b[1].pick - a[1].ban - a[1].pick).slice(0, 12)) {
    cellRow(el('meta'), [heroName(hero), ratio(item.pick, selected.length), ratio(item.ban, selected.length), ratio(item.wins, item.pick)]);
  }
  for (const [name, sides] of [...teams].sort(([a], [b]) => a.localeCompare(b))) {
    cellRow(el('teams'), [name, ...sides.map(([wins, total]) => ratio(wins, total))]);
  }
  if (!selected.length) {
    cellRow(el('meta'), ['此版本／日期沒有資料']);
    cellRow(el('teams'), ['此版本／日期沒有資料']);
  }
}
async function start() {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('無法下載比賽快照');
  snapshot = await response.json();
  const {games} = snapshot;
  const last = games.at(-1).date;
  el('coverage').textContent = games.length + ' 局 LCK · ' + games[0].date + ' 至 ' + last + ' · 截止日當天不計入';
  const teamOptions = [...new Set(games.flatMap(game => game.teams))].sort().map(name => [name, name]);
  fill('blue', teamOptions);
  fill('red', teamOptions);
  el('red').selectedIndex = 1;
  for (const [id, other] of [['blue','red'], ['red','blue']]) {
    el(id).onchange = () => {
      if (el(id).value === el(other).value) el(other).selectedIndex = (el(id).selectedIndex + 1) % teamOptions.length;
      render();
    };
  }
  fill('patch', [...new Map(games.map(game => [game.patch, game.label]))].sort(([a], [b]) => b - a));
  el('date').value = new Date(Date.parse(last) + 86400000).toISOString().slice(0, 10);
  for (const id of ['first', 'patch', 'date']) el(id).onchange = render;
  el('search').oninput = render;
  el('skip').onclick = () => { state.actions.push(null); render(); };
  el('undo').onclick = () => {
    if (state.actions.length) state.actions.pop();
    else {
      const previous = state.history.pop();
      state.actions = previous.actions;
      el('first').value = previous.first;
    }
    render();
  };
  el('next').onclick = () => {
    state.history.push({actions: state.actions, first: el('first').value});
    state.actions = [];
    render();
  };
  el('reset').onclick = () => { state = {actions: [], history: []}; render(); };
  render();
}

start().catch(error => { el('coverage').textContent = error.message; });
