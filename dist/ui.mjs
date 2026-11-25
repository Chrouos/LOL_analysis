// Shared table structure. Page modules own data, column order and custom cells.
export function renderTable(id, columns, rows, {rowHeader = false, cell, empty = '沒有符合條件的資料'} = {}) {
  const root = document.getElementById(id);
  if (!root) return;
  const table = document.createElement('table');
  table.className = 'data-table';
  const head = table.createTHead().insertRow();
  for (const text of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    head.append(th);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    values.forEach((value, index) => {
      const target = document.createElement(rowHeader && index === 0 ? 'th' : 'td');
      if (rowHeader && index === 0) target.scope = 'row';
      target.textContent = value ?? '—';
      cell?.(target, value, index);
      row.append(target);
    });
  }
  if (!rows.length) {
    const placeholder = body.insertRow().insertCell();
    placeholder.colSpan = columns.length;
    placeholder.className = 'empty-cell';
    placeholder.textContent = empty;
  }
  root.replaceChildren(table);
}
