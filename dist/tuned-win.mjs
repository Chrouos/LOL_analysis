import {renderTable as table} from './ui.mjs';

const get = id => document.getElementById(id);
function element(tag, text, parent) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
const pct = rate => (100 * rate).toFixed(1) + '%';
try {
  const response = await fetch('./tuned-win.json');
  if (!response.ok) throw new Error();
  const data = await response.json();
  const summary = get('tuned-summary');
  summary.replaceChildren();
  summary.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:16px 0';
  for (const key of ['合計', 'LCK', 'LPL']) {
    const [n, achieved] = data.test[key];
    const baseline = data.baseline[key][1];
    const card = element('article', '', summary);
    card.style.cssText = 'padding:14px;border:1px solid var(--line);border-radius:9px;background:#101726';
    element('strong', key + ' · ' + n + ' 局', card);
    const headline = element('div', pct(achieved), card);
    headline.style.cssText = 'font-size:2rem;color:var(--lime);font-weight:750';
    element('small', 'Elo 基準 ' + pct(baseline) + ' · 目標 70%', card);
    const track = element('div', '', card);
    track.style.cssText = 'height:9px;background:#303648;border-radius:4px;position:relative;margin-top:9px';
    const fill = element('span', '', track);
    fill.style.cssText = 'height:100%;display:block;border-radius:4px;background:#91d7a3;width:' + pct(achieved);
    const marker = element('span', '', track);
    marker.style.cssText = 'position:absolute;left:70%;top:-2px;height:13px;border-left:2px solid white';
  }
  const delta = (after, before) => {
    const difference = 100 * (after - before);
    return (difference > 0 ? '+' : '') + difference.toFixed(1) + ' pp';
  };
  table('tuned-comparison', ['從完整賽前模型調整', '合計差異', 'LCK 差異', 'LPL 差異'],
    data.comparisons.map(([name, results]) => [name, ...['合計','LCK','LPL'].map(k => delta(results[k][1], data.full[k][1]))]));
  element('p', '完整賽前模型正確率 ' + pct(data.full['合計'][1]) + '。已完成選角包含先發資訊。', get('tuned-comparison'));
  const formula = get('tuned-formula');
  element('p', '選定特徵 ' + data.groups.join('、') + ' · 半衰期 ' + data.half_life + ' 天 · C = ' + data.c + ' · 訓練 ' + data.training + ' 局。', formula);
  element('p', '藍方勝率 = 1 ÷ (1 + e⁻ᶻ)，z = ' + data.intercept.toFixed(6) + ' ＋ Σ [權重 × (特徵值 − 訓練平均) ÷ 訓練標準差]。', formula);
  table('tuned-weights', ['特徵', '權重', '訓練平均', '訓練標準差'],
    data.weights.map(([name, ...numbers]) => [name, ...numbers.map(n => n.toFixed(6))]));
} catch {
  get('tuned-summary').textContent = '無法載入權重實驗';
}
