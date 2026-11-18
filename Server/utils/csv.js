// Quotes a CSV cell, and neutralises leading =,+,-,@ so user-entered text can't
// run as a formula when the file is opened in Excel/Sheets.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Builds the CSV text (with a BOM so Excel reads ₹ and non-English names as UTF-8)
// and sends it as a file download.
function sendCsv(res, filenameBase, header, rows) {
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const safeName = filenameBase.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'export';
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${safeName}_${date}.csv"`,
    'Cache-Control': 'no-store',
    // The client is on a different origin, so the filename header must be exposed to it.
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.send(csv);
}

module.exports = { csvCell, sendCsv };
