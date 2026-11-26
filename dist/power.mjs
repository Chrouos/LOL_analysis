import {renderTable} from './ui.mjs';

const el = id => document.getElementById('power-' + id);
const metrics = ['補兵／分','傷害／分','賺取經濟／分','傷害／賺取金幣','參團率','視野／分'];
const mean = list => list.reduce((a,b)=>a+b,0) / list.length;
const pct = value => (100 * value).toFixed(1) + '%';
function options(key, teams, fallback) {
  const select = el(key), old = select.value;
  select.replaceChildren(...teams.map(([name]) => new Option(name, name)));
  if (teams.some(([name]) => name === old)) select.value = old;
  else select.selectedIndex = fallback;
}

function radar(profile) {
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
  if (profile[5].every(value=>value !== null)) {
    polygon(profile[5].map((value,i)=>point(i,value*.88)),'#bff479','#bff47955');
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
  if (profile[5].some(value=>value === null)) {
    const note = document.createElement('p');
    note.className='note';
    note.textContent='部分維度樣本不足，已保留右側數值。';
    root.append(note);
  }
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
    const rankings = teams.map(([name,elo,date,lineup],i)=>{
      const playerValues = lineup.map(index=>profiles[index][5]);
      const roster = playerValues.every(values=>values.every(value=>value !== null)) ? mean(playerValues.flat()) : null;
      const score = roster === null ? null : .7 * 100 * (teams.length-i-.5)/teams.length + .3 * roster;
      return {name,elo,date,lineup,roster,score};
    }).sort((a,b)=>(b.score ?? -1)-(a.score ?? -1));
    renderTable('power-rank',['隊伍','實力指數','Elo','陣容平均百分位','最後出賽','歷史陣容'],
      rankings.map(row=>[row.name,row.score?.toFixed(1),row.elo,row.roster?.toFixed(1),row.date,row.lineup.map(i=>profiles[i][2]).join(' · ')]),{rowHeader:true});
    const profile = profiles[team[3][Number(el('role').value)]];
    radar(profile);
    renderTable('power-player',[profile[2] + ' · ' + profile[3] + ' 局','數值','百分位','有效局數'],
      metrics.map((label,i)=>[label,profile[4][i]?.toFixed(2),profile[5][i],profile[6][i]]),{rowHeader:true});
  }
  function changeVenue() {
    const {teams} = data[el('venue').value];
    options('team',teams,0);options('opponent',teams,1);
    render();
  }
  el('venue').onchange=changeVenue;
  for (const key of ['team','opponent','role']) el(key).onchange=render;
  changeVenue();
} catch { el('scope').textContent='實力資料載入失敗'; }
