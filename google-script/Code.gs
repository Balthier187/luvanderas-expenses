/**
 * Luvanderas Expenses — Google Sheet receiver.
 * Paste this into the Sheet's Extensions > Apps Script, run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * The website sends each expense here; this script adds one row to the
 * "Expenses" tab and saves any receipt photo in the Drive folder below.
 * Stock counts go to the "Inventory" tab, one row per item counted.
 */

const SPREADSHEET_ID = '1HvMlFk-iLpPlk_2IKcG-4ax8feR2sCzgW748crJJZ8M'; // Evan's "Luvanderas Expenses" Google Sheet
const SHEET_NAME = 'Expenses';
const FOLDER_NAME = 'Luvanderas receipts';
const PEOPLE = ['Evan', 'Mary Jean', 'Edna', 'Kristel', 'Lorie'];
const CATEGORIES = ['Supplies', 'Plastic & packaging', 'Utilities', 'Rent', 'Salary',
  'Staff loan', 'Repairs', 'Transport', 'Bahay (household)', 'Other'];
const INV_SHEET = 'Inventory';
// [item, big unit, pieces per big unit, small unit, pieces per small unit]. Big unit '' = none.
// Plastic: 1 pack = 5 rolls, 1 roll = 20 sheets, so 1 pack = 100 pieces.
const ITEMS = [
  ['Surf Liquid Detergent sachet', 'cases', 288, 'loose', 1],
  ['Surf Fabric Conditioner sachet', 'cases', 126, 'loose', 1],
  ['Ariel Liquid sachet', 'cases', 126, 'loose', 1],
  ['Zonrox Color Safe sachet', 'cases', 360, 'loose', 1],
  ['Downy sachet', '', 0, 'pcs', 1],
  ['Plastic Big', 'packs', 100, 'rolls', 20],
  ['Plastic for Dry Clean', 'packs', 100, 'rolls', 20],
  ['Aroma Sheets', '', 0, 'pcs', 1]
];
const INV_HEADERS = ['Logged at', 'Count date', 'Counted by', 'Item', 'Cases / packs',
  'Loose / rolls', 'Total pieces', 'Note', 'Count ID'];
const HEADERS = ['Logged at', 'Date', 'Logged by', 'Paid by', 'Category', 'Amount',
  'Note', 'Receipt', 'Posted', 'Entry ID'];

function setup() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('#,##0.00');
  }
  let inv = ss.getSheetByName(INV_SHEET);
  if (!inv) inv = ss.insertSheet(INV_SHEET);
  if (inv.getLastRow() === 0) {
    inv.appendRow(INV_HEADERS);
    inv.setFrozenRows(1);
    inv.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    inv.getRange('B:B').setNumberFormat('@');
  }
  receiptFolder_();
}

function doGet() {
  return json_({ ok: true, people: PEOPLE, categories: CATEGORIES });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.type === 'count') return saveCount_(d);
    const amount = Math.round(Number(d.amount) * 100) / 100;
    if (!(amount > 0 && amount < 1000000)) return json_({ ok: false, error: 'Amount is missing or too large.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) return json_({ ok: false, error: 'Date is missing.' });
    if (d.method !== 'cash' && d.method !== 'gcash') return json_({ ok: false, error: 'Choose Cash or Gcash.' });
    if (CATEGORIES.indexOf(d.category) < 0) return json_({ ok: false, error: 'Unknown category.' });
    if (PEOPLE.indexOf(d.by) < 0) return json_({ ok: false, error: 'Unknown name.' });
    const id = String(d.id || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
    if (!id) return json_({ ok: false, error: 'Missing entry id.' });

    let sh = ss_().getSheetByName(SHEET_NAME);
    if (!sh) { setup(); sh = ss_().getSheetByName(SHEET_NAME); }
    // Ignore a resend of the same entry (phone retried after a slow connection).
    const last = sh.getLastRow();
    if (last > 1) {
      const start = Math.max(2, last - 300);
      const ids = sh.getRange(start, 10, last - start + 1, 1).getValues().flat();
      if (ids.indexOf(id) >= 0) return json_({ ok: true, duplicate: true });
    }

    let link = '';
    if (d.photo) {
      const b64 = String(d.photo);
      if (b64.length > 6000000) return json_({ ok: false, error: 'Photo is too large.' });
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg',
        d.date + ' ' + d.by + ' ' + amount + ' ' + id.slice(0, 6) + '.jpg');
      link = receiptFolder_().createFile(blob).getUrl();
    }

    sh.appendRow([new Date(), d.date, d.by, d.method === 'cash' ? 'Cash' : 'Gcash', d.category,
      amount, safeText_(d.note), link, '', id]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Could not save (' + String(err && err.message || err).slice(0, 120) + ').' });
  } finally {
    lock.releaseLock();
  }
}

function saveCount_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) return json_({ ok: false, error: 'Date is missing.' });
  if (PEOPLE.indexOf(d.by) < 0) return json_({ ok: false, error: 'Unknown name.' });
  const id = String(d.id || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (!id) return json_({ ok: false, error: 'Missing count id.' });
  const lines = Array.isArray(d.items) ? d.items : [];
  const rows = [];
  const now = new Date();
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const def = ITEMS.filter(function (it) { return it[0] === L.item; })[0];
    if (!def) return json_({ ok: false, error: 'Unknown item.' });
    const big = def[2] ? Math.floor(Number(L.cases) || 0) : 0;
    const small = Math.floor(Number(L.loose) || 0);
    if (big < 0 || small < 0 || big > 1000 || small > 100000) return json_({ ok: false, error: 'A count looks wrong.' });
    rows.push([now, d.date, d.by, def[0], def[2] ? big : '', small, big * def[2] + small * def[4], safeText_(d.note), id]);
  }
  if (!rows.length) return json_({ ok: false, error: 'Enter at least one count.' });
  let sh = ss_().getSheetByName(INV_SHEET);
  if (!sh) { setup(); sh = ss_().getSheetByName(INV_SHEET); }
  const last = sh.getLastRow();
  if (last > 1) {
    const start = Math.max(2, last - 500);
    const ids = sh.getRange(start, 9, last - start + 1, 1).getValues().flat();
    if (ids.indexOf(id) >= 0) return json_({ ok: true, duplicate: true });
  }
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
  return json_({ ok: true });
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function receiptFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// Stop text that starts with = + - @ from being read as a formula.
function safeText_(v) {
  const s = String(v || '').slice(0, 300).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
