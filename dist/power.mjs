import {renderTable} from './ui.mjs';
import {rankTeams, comparableStints} from './power-stats.mjs';

const el = id => document.getElementById('power-' + id);
const metrics = ['補兵／分','傷害／分','賺取經濟／分','傷害／賺取金幣','參團率','視野／分'];
const roles = {top: '上路', jng: '打野', mid: '中路', bot: '下路', sup: '輔助'};
const pct = value => (100 * value).toFixed(1) + '%';
function options(key, teams, fallback) {
  const select = el(key), old = select.value;
  select.replaceChildren(...teams.map(([name]) => new Option(name, name)));
  if (teams.some(([name]) => name === old)) select.value = old;
  else select.selectedIndex = fallback;
}

function radar(profile, comparison) {
  const root = el('radar');
  root.replaceChildren();
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 290 250');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label',profile[2] + ' 的同位置百分位雷達');
  const point = (i,r) => {
    const a = i * Math.PI / 3 - Math.PI / 2;
    return [145 + r * Math.cos(a),125 + r * Math.sin(a)];
  };
  function polygon(points,color,fill) {
    const node = document.createElementNS(ns,'polygon');
    node.setAttribute('points',points.map(p=>p.join(',')).join(' '));
    node.setAttribute('stroke',color);
    node.setAttribute('fill',fill);
    svg.append(node);
  }
  for (const r of [22,44,66,88]) polygon(metrics.map((_,i)=>point(i,r)),'#414b61','none');
  const series = [[profile,'#bff479','#bff47935'], [comparison,'#83bcff','#83bcff35']].filter(([row]) => row);
  for (const [row,color,fill] of series) {
    if (row[5].every(Number.isFinite)) polygon(row[5].map((value,i)=>point(i,value*.88)),color,fill);
  }
  const labels = ['補兵','傷害','經濟','傷害轉換','參團','視野'];
  labels.forEach((label,i)=>{
    const node = document.createElementNS(ns,'text');
    const [x,y] = point(i,112);
    node.setAttribute('x',x);node.setAttribute('y',y);
    node.setAttribute('text-anchor','middle');
    node.setAttribute('fill','#cbd5e5');
    node.setAttribute('font-size','12');
    node.textContent = label;
    svg.append(node);
  });
  root.append(svg);
  const legend = document.createElement('div');
  legend.className = 'power-legend';
  for (const [row, color] of series) {
    const caption = document.createElement('span');
    caption.style.borderColor = color;
    caption.textContent = row[0] + ' · ' + row[3] + ' 局' +
      (row[5].every(Number.isFinite) ? '' : '（部分指標不足 10 局）');
    legend.append(caption);
  }
  root.append(legend);
}

try {
  const response = await fetch('./power.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  function render() {
    const venue = el('venue').value;
    const {teams, profiles, games} = data[venue];
    const team = teams.find(row=>row[0]===el('team').value);
    const enemy = teams.find(row=>row[0]===el('opponent').value);
    const dates = teams.map(row=>row[2]).sort();
    el('scope').textContent = '2026 ' + venue + ' · ' + games + ' 局 · 至 ' + dates.at(-1) + ' · 歷史陣容';
    el('probability').textContent = team === enemy ? '選擇兩支不同隊伍比較。' :
      team[0] + ' 對 ' + enemy[0] + ' · Elo 預期 ' + pct(1 / (1 + 10 ** (-(team[1]-enemy[1])/400)));
    renderTable('power-rank',['隊伍','實力指數','Elo','Elo 百分位','陣容平均百分位','最後出賽','歷史陣容'],
      rankTeams(teams, profiles).map(row=>[row.name,row.score?.toFixed(1),row.elo,row.eloPercentile.toFixed(1),
        row.roster?.toFixed(1),row.date,row.lineup.map(i=>profiles[i][2]).join(' · ')]),{rowHeader:true});
  }
  const career = {
    Faker: [ ['2026','世界賽','T1','四強（第 3–4 名）'], ['2026','MSI','T1','第 5–6 名'],
      ['2025','世界賽','T1','冠軍'], ['2025','MSI','T1','亞軍'], ['2024','世界賽','T1','冠軍'] ],
    Chovy: [ ['2026','世界賽','Gen.G','亞軍'], ['2025','MSI','Gen.G','冠軍'] ],
    Knight: [ ['2026','世界賽','Bilibili Gaming','冠軍'], ['2026','MSI','Bilibili Gaming','亞軍'],
      ['2025','世界賽','Bilibili Gaming','第 9–11 名'], ['2025','MSI','Bilibili Gaming','第 4 名'] ],
  };
  const careerSources = {
    Faker: 'https://guessports.com/en/lol/jugador/faker/',
    Chovy: 'https://liquipedia.net/leagueoflegends/Chovy/Results',
    Knight: 'https://liquipedia.net/leagueoflegends/Knight/Results',
  };
  const params = new URLSearchParams(location.search);
  function renderProfile() {
    const {profiles} = data[el('player-venue').value];
    const current = profiles[Number(el('stint').value)];
    if (!current) return;
    const [team, position, player] = current;
    const candidates = comparableStints(profiles, current);
    const compare = el('compare');
    const previous = compare.value;
    compare.replaceChildren(new Option('只看 ' + team, ''), ...candidates.map(([row,i]) => new Option(row[0],i)));
    if (candidates.some(([,i]) => String(i) === previous)) compare.value = previous;
    el('compare-field').hidden = !candidates.length;
    const other = compare.value === '' ? null : profiles[Number(compare.value)];
    const metric = (row,i) => {
      const value = row[4][i], percentile = row[5][i];
      if (!Number.isFinite(value)) return '— · 0 局';
      return value.toFixed(2) + (i === 4 ? '%' : '') + ' · ' +
        (Number.isFinite(percentile) ? 'P' + percentile : '—') + ' · ' + row[6][i] + ' 局';
    };
    radar(current, other);
    renderTable('power-player',['指標',team,...(other ? [other[0]] : [])],
      metrics.map((label,i) => [label, metric(current,i), ...(other ? [metric(other,i)] : [])]), {rowHeader:true});
    renderTable('power-stints',['同位置隊伍','位置','出賽局數'],
      [current,...candidates.map(([row]) => row)].map(row => [row[0], roles[position], row[3]]),{rowHeader:true});
    renderTable('power-career',['賽季','賽事','隊伍','名次'],career[player] ?? [],
      {empty:'目前沒有收錄這位選手的國際賽名次'});
    if (careerSources[player]) {
      const source = document.createElement('a');
      source.href = careerSources[player];
      source.textContent = '選手成績來源';
      el('career').append(source);
    }
  }
  function changePerson(preferredTeam) {
    const {profiles} = data[el('player-venue').value];
    const player = el('person').value;
    const stints = profiles.map((row, i) => [row,i]).filter(([row]) => row[2] === player)
      .sort(([a],[b]) => b[3] - a[3]);
    el('stint').replaceChildren(...stints.map(([row,i]) => new Option(row[0] + ' · ' + roles[row[1]] + ' · ' + row[3] + ' 局', i)));
    const preferred = stints.find(([row]) => row[0] === preferredTeam);
    if (preferred) el('stint').value = String(preferred[1]);
    renderProfile();
  }
  function changeProfileVenue(preferredPerson, preferredTeam) {
    const {profiles} = data[el('player-venue').value];
    const names = [...new Set(profiles.map(row => row[2]))].sort((a,b) => a.localeCompare(b));
    el('person').replaceChildren(...names.map(name => new Option(name,name)));
    el('compare').value = '';
    const person = preferredPerson ?? (names.includes('Faker') ? 'Faker' : names[0]);
    if (names.includes(person)) el('person').value = person;
    changePerson(preferredTeam);
  }
  function changeVenue() {
    const {teams} = data[el('venue').value];
    options('team',teams,0);options('opponent',teams,1);
    render();
  }
  el('venue').onchange=changeVenue;
  for (const key of ['team','opponent']) el(key).onchange=render;
  changeVenue();
  if (Object.hasOwn(data, params.get('venue'))) el('player-venue').value = params.get('venue');
  el('player-venue').onchange = () => changeProfileVenue();
  el('person').onchange = () => { el('compare').value = ''; changePerson(); };
  el('stint').onchange = () => { el('compare').value = ''; renderProfile(); };
  el('compare').onchange = renderProfile;
  changeProfileVenue(params.get('player'), params.get('team'));
} catch { el('scope').textContent='實力資料載入失敗'; }


try {
  const response = await fetch('./worlds-2026-series.json');
  if (!response.ok) throw new Error();
  const series = await response.json();
  const stages = ['瑞士輪','八強','四強','亞軍','冠軍'];
  const teams = new Map();
  for (const [, stage, a, aw, bw, b] of series) {
    for (const [name,wins,losses] of [[a,aw,bw],[b,bw,aw]]) {
      const row = teams.get(name) ?? {name, wins:0, losses:0, stage:0};
      const placement = {QUARTERFINALS:1,SEMIFINALS:2,FINALS:wins > losses ? 4 : 3}[stage] ?? 0;
      row.stage = Math.max(row.stage,placement);
      row.wins += wins; row.losses += losses;
      teams.set(name,row);
    }
  }
  const ratio = row => row.wins / (row.wins + row.losses);
  const rows = [...teams.values()].sort((a,b) => b.stage - a.stage || ratio(b) - ratio(a));
  renderTable('power-worlds',['隊伍','最高階段','勝局','敗局','單局勝率'],
    rows.map(row => [row.name, stages[row.stage], row.wins, row.losses, pct(ratio(row))]), {rowHeader:true});
} catch { el('worlds').textContent = '世界賽資料載入失敗'; }
