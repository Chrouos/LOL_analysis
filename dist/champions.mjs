import {championIcons} from './champion-icons.mjs';
import {duels, playerPool, draftRates} from './champion-stats.mjs';

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
    const icon = championIcons[name(hero)];
    if (icon) {
      const img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.width = img.height = 24;
      img.style.cssText = 'vertical-align:middle;margin-right:8px;border-radius:4px';
      img.src = 'https://ddragon.leagueoflegends.com/cdn/16.23.1/img/champion/' + icon;
      cell.append(img);
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
  opponentOptions();
}
function opponentOptions() {
  const stats = duels(games, {role:id('role'),hero:id('hero'),player:id('player'),opponent:-1});
  options('opponent', ordered(stats.keys(),data.heroes), '全部對手英雄');
  showDuel();
}
function showDuel() {
  const stats = duels(games, {role:id('role'),hero:id('hero'),player:id('player'),opponent:id('opponent')});
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
  const query = el('query').value.trim().toLowerCase();
  const rates = [...byHero].filter(([h])=>name(h).toLowerCase().includes(query))
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
    const response = await fetch('./champions-'+el('season').value+'.json');
    if (!response.ok) throw new Error();
    const loaded = await response.json();
    if (token !== request) return;
    data = loaded;
    options('venue',[...new Set(data.games.map(g=>g[0]))].sort().map(v=>[v,v==='WLDs'?'世界賽':v]));
    venueChanged();
  } catch { if (token === request) el('coverage').textContent = '無法載入賽季資料'; }
}
for (const [key,handler] of Object.entries({season:load,venue:venueChanged,stage:stageChanged,role:duelOptions,
  player:heroOptions,hero:opponentOptions,opponent:showDuel,'pool-player':showPool})) el(key).onchange=handler;
el('query').oninput=showDraft;
load();
