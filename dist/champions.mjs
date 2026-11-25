import {championLocales} from './champion-locales.mjs';
import {championIcons} from './champion-icons.mjs';
import {duels, duelComparison, playerPool, draftRates} from './champion-stats.mjs';

const el = id => document.getElementById(id);
let data, games;
function options(id, values, placeholder) {
  const select = el(id), old = select.value;
  const list = values.map(([value, title]) => new Option(title, value));
  if (placeholder) list.unshift(new Option(placeholder, ''));
  select.replaceChildren(...list);
  if (list.some(option => option.value === old)) select.value = old;
}
const id = key => el(key).value === '' ? -1 : Number(el(key).value);
const ordered = (ids, names) => [...new Set(ids)].map(i => [i, names[i]]).sort((a,b) => a[1].localeCompare(b[1]));
const name = hero => data.heroes[hero];
const normalize = value => value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
function heroIcon(english, size) {
  const file = championIcons[english];
  if (!file) return null;
  const img = document.createElement('img');
  img.alt = ''; img.width = img.height = size;
  img.loading = 'lazy';
  img.src = 'https://ddragon.leagueoflegends.com/cdn/16.23.1/img/champion/' + file;
  img.onerror = () => img.remove();
  return img;
}
function localizedName(english) {
  return championLocales[championIcons[english]?.replace(/\.png$/, '')] ?? [];
}
function renderPicker(key) {
  const select = el(key);
  const current = el(key + '-current');
  current.replaceChildren();
  const selected = select.selectedOptions[0];
  if (selected) {
    const english = selected.textContent;
    const icon = heroIcon(english, 32);
    if (icon) current.append(icon);
    const [local] = localizedName(english);
    current.append(local ? local + ' · ' + english : english);
  } else current.textContent = '無可選英雄';
  const filter = normalize(el(key + '-search').value);
  const grid = el(key + '-grid');
  grid.replaceChildren();
  for (const option of select.options) {
    const english = option.textContent;
    const [local, title] = localizedName(english);
    if (option.value && filter && ![english, local, title].some(name => name && normalize(name).includes(filter))) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero-option' + (option.value ? '' : ' hero-option-all');
    button.setAttribute('aria-pressed', String(option.selected));
    button.setAttribute('aria-label', local ? local + ' · ' + english : english);
    if (local) button.title = english + (title ? ' · ' + title : '');
    const icon = heroIcon(english, 36);
    if (icon) button.append(icon);
    const label = document.createElement('span');
    label.textContent = local || english;
    button.append(label);
    button.onclick = () => {
      select.value = option.value;
      el(key + '-search').value = '';
      el(key + '-picker').open = false;
      select.onchange();
      renderPicker(key);
      el(key + '-picker').querySelector('summary').focus();
    };
    grid.append(button);
  }
  if (!grid.childElementCount || (filter && !grid.querySelector('button:not(.hero-option-all)'))) {
    const message = document.createElement('span');
    message.textContent = '沒有符合的英雄';
    message.style.gridColumn = '1 / -1';
    grid.append(message);
  }
}

function bar(cell, n, total, color) {
  if (!total) { cell.textContent = '—'; return; }
  const value = (100 * n / total).toFixed(1) + '%';
  cell.textContent = value + ' · ' + n + '/' + total;
  const meter = document.createElement('meter');
  meter.min = 0; meter.max = 1; meter.value = n / total;
  meter.setAttribute('aria-hidden', 'true');
  meter.style.cssText = 'display:block;width:115px;height:11px;accent-color:' + color;
  cell.append(meter);
}
function chart(target, labels, rows) {
  const root = el(target);
  root.replaceChildren();
  if (!rows.length) { root.textContent = '此篩選範圍沒有對局。'; return; }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const text of labels) {
    const th = document.createElement('th');
    th.scope = 'col'; th.textContent = text; head.append(th);
  }
  const body = table.createTBody();
  for (const [hero, ...values] of rows) {
    const row = body.insertRow(), cell = row.insertCell();
    const icon = heroIcon(name(hero), 24);
    if (icon) {
      icon.style.cssText = 'vertical-align:middle;margin-right:8px;border-radius:4px';
      cell.append(icon);
    }
    cell.append(name(hero));
    values.forEach(([n,total,color]) => bar(row.insertCell(),n,total,color));
  }
  root.append(table);
}
function duelOptions() {
  const role = id('role');
  const eligible = games.flatMap(g => [g[5][role],g[5][role+5]]).filter(Boolean);
  options('player', ordered(eligible.map(p=>p[0]),data.players), '全部選手');
  heroOptions();
}
function heroOptions() {
  const role = id('role'), player = id('player');
  const eligible = games.flatMap(g => [g[5][role],g[5][role+5]])
    .filter(p => p && (player < 0 || p[0] === player));
  options('hero', ordered(eligible.map(p=>p[1]),data.heroes));
  renderPicker('hero');
  opponentOptions();
}
function opponentOptions() {
  const stats = duels(games, {role:id('role'),hero:id('hero'),player:id('player'),opponent:-1});
  options('opponent', ordered(stats.keys(),data.heroes), '全部對手英雄');
  renderPicker('opponent');
  showDuel();
}
function drawComparison(filters) {
  const root = el('duel-comparison');
  root.replaceChildren();
  const {gamesPlayed, wins, expected, covered, coveredWins} = duelComparison(games, filters);
  if (!gamesPlayed) return;
  function add(parent, tag, text, cls) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    parent.append(node);
    return node;
  }
  const title = add(root, 'div', '', 'duel-comparison-title');
  const left = name(filters.hero), right = name(filters.opponent);
  for (const [hero, label] of [[left, (filters.player >= 0 ? data.players[filters.player] + ' · ' : '') + left],
                                [right, right || '所有對手']]) {
    const chip = add(title, 'span', '', 'duel-champion');
    const icon = hero && heroIcon(hero, 40);
    if (icon) chip.append(icon);
    chip.append(label);
    if (hero === left) add(title, 'span', '對');
  }
  if (gamesPlayed < 10) add(root, 'p', '小樣本 · 未滿 10 局', 'duel-small');
  const pct = p => (100 * p).toFixed(1) + '%';
  const metrics = add(root, 'div', '', 'duel-metrics');
  const difference = covered ? 100 * (coveredWins - expected) / covered : null;
  for (const [label, value, note] of [
    ['實際勝率', pct(wins / gamesPlayed), wins + ' 勝／' + gamesPlayed + ' 局'],
    ['Elo 預期', covered ? pct(expected / covered) : '—', covered + ' 局有預期值'],
    ['實際與預期差', difference === null ? '—' : (difference > 0 ? '+' : '') + difference.toFixed(1) + ' pp',
     covered === gamesPlayed ? '同一批對局' : '僅比較有預期值的對局'],
  ]) {
    const box = add(metrics, 'div', '', 'duel-metric');
    add(box, 'span', label); add(box, 'strong', value); add(box, 'small', note);
  }
  add(root, 'p', 'Elo 以當日前的隊伍戰績估計。差值可能受陣容、版本與選手影響。', 'note');
}
function showDuel() {
  const filters = {role:id('role'),hero:id('hero'),player:id('player'),opponent:id('opponent')};
  const stats = duels(games, filters);
  drawComparison(filters);
  chart('duel-chart',['對手英雄','英雄 A 整局勝率'], [...stats].sort((a,b)=>b[1][0]-a[1][0])
    .map(([hero,[n,w]])=>[hero,[w,n,'#a4dc85']]));
}
function showPool() {
  const stats = [...playerPool(games,id('pool-player'))].sort((a,b)=>b[1][0]-a[1][0]);
  const matches = stats.reduce((n,[,[count]])=>n+count,0);
  chart('pool-chart',['英雄','選手使用率','整局勝率'],stats.map(([h,[n,w]])=>[h,[n,matches,'#8bb6ff'],[w,n,'#a4dc85']]));
}
function showDraft() {
  const {byHero,pickGames,banGames} = draftRates(games);
  const query = normalize(el('query').value);
  const rates = [...byHero].filter(([h])=>[name(h), ...localizedName(name(h))].some(label => normalize(label).includes(query)))
    .sort((a,b)=>(b[1][0]+b[1][1])-(a[1][0]+a[1][1]));
  chart('draft-chart',['英雄','Pick 率','Ban 率'],rates.map(([h,[picked,banned]])=>[h,[picked,pickGames,'#8bb6ff'],[banned,banGames,'#ff9594']]));
}
function stageChanged() {
  games = data.games.filter(g=>g[0]===el('venue').value && (!el('stage').value || g[1]===el('stage').value));
  const dates = games.map(g=>g[2]).sort();
  const coverage = draftRates(games);
  el('coverage').textContent = games.length ? dates[0]+' 至 '+dates.at(-1)+' · '+games.length+' 局 · Pick 紀錄 '+coverage.pickGames+' 局 · Ban 紀錄 '+coverage.banGames+' 局' : '沒有收錄對局';
  options('pool-player',ordered(games.flatMap(g=>g[5].filter(Boolean).map(p=>p[0])),data.players));
  duelOptions(); showPool(); showDraft();
}
function venueChanged() {
  options('stage',[...new Set(data.games.filter(g=>g[0]===el('venue').value).map(g=>g[1]))].map(s=>[s,s]),'全部階段');
  stageChanged();
}
let request = 0;
async function load() {
  const token = ++request;
  el('coverage').textContent = '載入中';
  try {
    const year = el('season').value;
    const [response, elo] = await Promise.all([
      fetch('./champions-' + year + '.json'),
      fetch('./duel-elo-' + year + '.json').then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    if (!response.ok) throw new Error();
    const loaded = await response.json();
    if (elo.length === loaded.games.length) loaded.games = loaded.games.map((game, i) => [...game, elo[i]]);
    if (token !== request) return;
    data = loaded;
    options('venue',[...new Set(data.games.map(g=>g[0]))].sort().map(v=>[v,v==='WLDs'?'世界賽':v]));
    venueChanged();
  } catch { if (token === request) el('coverage').textContent = '無法載入賽季資料'; }
}
for (const [key,handler] of Object.entries({season:load,venue:venueChanged,stage:stageChanged,role:duelOptions,
  player:heroOptions,hero:opponentOptions,opponent:showDuel,'pool-player':showPool})) el(key).onchange=handler;
el('query').oninput=showDraft;
for (const key of ['hero', 'opponent']) {
  const panel = el(key + '-picker');
  const search = el(key + '-search');
  search.oninput = () => renderPicker(key);
  panel.ontoggle = () => {
    if (!panel.open) return;
    el((key === 'hero' ? 'opponent' : 'hero') + '-picker').open = false;
    search.focus();
  };
  panel.onkeydown = event => {
    if (event.key !== 'Escape' || !panel.open) return;
    panel.open = false;
    panel.querySelector('summary').focus();
  };
}
load();
