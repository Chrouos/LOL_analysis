const get = id => document.getElementById(id);
function add(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
const root = get('matchup-scores');
try {
  const response = await fetch('./matchup-validation.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  const [games, wins] = data.fresh['0'].t1VsGeng.LCK;
  get('t1-geng').textContent = '新驗證集 · T1 對 Gen.G ' + wins + ' 勝 ' + (games - wins) + ' 敗（單局）。';
  function render() {
    const target = get('matchup-target').value;
    const venue = get('matchup-venue').value;
    const candidates = target === '勝負'
      ? Object.entries(data.fresh).flatMap(([carry, report]) =>
          report.scores.map(row => [carry, ...row]))
      : data.objectives.scores.map(row => ['—', ...row]);
    const rows = candidates.filter(([, t, , v]) => t === target && v === venue);
    root.replaceChildren();
    const selected = get('matchup-summary');
    if (!rows.length) {
      selected.textContent = '這個賽區的資料沒有該項標籤。';
      return;
    }
    const n = rows[0][4];
    selected.textContent = n + ' 局 · 白線標示 70% 目標';
    const table = add(root, 'table', '');
    const head = table.createTHead().insertRow();
    ['跨年 Elo', '特徵', '正確率', '猜對／局數', 'Log loss'].forEach(v => { add(head,'th',v).scope = 'col'; });
    const body = table.createTBody();
    for (const [carry, , variant, , total, hit, loss] of rows) {
      const row = body.insertRow();
      add(row, 'td', carry === '—' ? carry : Number(carry) * 100 + '%');
      add(row, 'td', variant);
      const accuracy = (100 * hit / total).toFixed(1) + '%';
      const cell = add(row, 'td', accuracy);
      const bar = add(cell, 'div', '');
      bar.style.cssText = 'width:100px;height:6px;position:relative;background:#303648;border-radius:4px';
      bar.setAttribute('aria-hidden', 'true');
      add(bar,'span','').style.cssText = 'display:block;height:100%;border-radius:4px;background:var(--lime);width:' + accuracy;
      add(bar,'span','').style.cssText = 'position:absolute;left:70%;top:-2px;height:10px;border-left:1px solid white';
      add(row, 'td', hit + '/' + total);
      add(row, 'td', loss.toFixed(3));
    }
  }
  get('matchup-target').onchange = get('matchup-venue').onchange = render;
  render();
} catch { root.textContent = '無法載入回測'; }
