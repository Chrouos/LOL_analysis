const container = document.getElementById('win-model');
try {
  const response = await fetch('./win-model.json');
  if (!response.ok) throw new Error();
  const {results} = await response.json();
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  for (const label of ['累加特徵', '全部 · 341 局', 'LCK · 170 局', 'LPL · 171 局', '合計 Log loss']) {
    const column = document.createElement('th');
    column.scope = 'col'; column.textContent = label; header.append(column);
  }
  const body = table.createTBody();
  for (const [name, groups] of results) {
    const row = body.insertRow();
    row.insertCell().textContent = name;
    for (const [, , accuracy] of groups) row.insertCell().textContent = (accuracy * 100).toFixed(1) + '%';
    row.insertCell().textContent = groups[0][3].toFixed(3);
  }
  container.replaceChildren(table);
} catch {
  container.textContent = '無法載入特徵比較';
}
