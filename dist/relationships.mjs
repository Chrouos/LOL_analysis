const el = id => document.getElementById(id);
const roles = ['上路','打野','中路','下路','輔助'];
const objectives = ['首小龍','首預示者','首巴龍'];
const pct = ratio => (100 * ratio).toFixed(1) + '%';
function table(id, headers, rows, colors = false) {
  const t = document.createElement('table');
  const head = t.createTHead().insertRow();
  headers.forEach(label => {
    const th = document.createElement('th');
    th.scope = 'col'; th.textContent = label; head.append(th);
  });
  const body = t.createTBody();
  for (const [first, ...values] of rows) {
    const tr = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row'; th.textContent = first; tr.append(th);
    for (const value of values) {
      const cell = tr.insertCell();
      cell.textContent = value ?? '—';
      if (colors && value !== null) {
        cell.textContent = value.toFixed(2);
        cell.style.background = value >= 0 ? 'rgba(66,166,218,' + Math.abs(value) * .55 + ')' :
          'rgba(242,124,94,' + Math.abs(value) * .55 + ')';
      }
    }
  }
  el(id).replaceChildren(t);
  if (!rows.length) el(id).textContent = '這組篩選沒有至少 2 局的對位。';
}
try {
  const response = await fetch('./feature-relationships.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  function render() {
    const venue = el('venue').value, version = el('version').value, role = el('role').value;
    const hero = el('hero').value.trim().toLowerCase();
    const {n, matrix, events} = data.venues[venue];
    el('matrix-note').textContent = n + ' 局 · 4 月起 · Pearson r。藍色為正相關，橙色為負相關，— 表示無法計算。';
    table('matrix', ['特徵', ...data.names], matrix.map((row,i) => [data.names[i], ...row]), true);
    const selected = data.matchups.filter(r => r[0] === venue && r[1] === version &&
      (!role || +role === r[2]) && (!hero || r.slice(3,5).some(name => name.toLowerCase().includes(hero))));
    table('matchups', ['位置','英雄 A','英雄 B','A 勝／局數','A 勝率','Elo 預期','勝率差'],
      selected.sort((a,b) => b[5] - a[5]).slice(0,50).map(([, ,role,a,b,n,w,expected]) => {
        const diff = (w - expected) / n * 100;
        return [roles[role],a,b,w + '/' + n,pct(w/n),pct(expected/n),(diff > 0 ? '+' : '') + diff.toFixed(1) + ' pp'];
      }));
    table('events',['物件','條件','局數','取得方勝率'],events.map(([i,label,n,w]) =>
      [objectives[i] ?? '首龍與預示者',label,n,label === '取得方' ? pct(w/n) : '—']));
  }
  function venueChanged() {
    const versions = [...new Set(data.matchups.filter(r => r[0] === el('venue').value).map(r => r[1]))];
    el('version').replaceChildren(...versions.map(v => new Option(v,v)));
    el('version').value = '全部';
    render();
  }
  el('venue').onchange = venueChanged;
  el('version').onchange = el('role').onchange = render;
  el('hero').oninput = render;
  venueChanged();
} catch { el('matrix').textContent = '無法載入關聯分析'; }
