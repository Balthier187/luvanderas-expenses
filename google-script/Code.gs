/**
 * Luvanderas Expenses — Google Sheet receiver.
 * Paste this into the Sheet's Extensions > Apps Script, run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * The website sends each expense here; this script adds one row to the
 * "Expenses" tab and saves any receipt photo in the Drive folder below.
 */

const SHEET_NAME = 'Expenses';
const FOLDER_NAME = 'Luvanderas receipts';
const PEOPLE = ['Evan', 'Wife', 'Edna', 'Kristel', 'Lorie'];
const CATEGORIES = ['Supplies', 'Plastic & packaging', 'Utilities', 'Rent', 'Salary',
  'Staff loan', 'Repairs', 'Transport', 'Bahay (household)', 'Other'];
const HEADERS = ['Logged at', 'Date', 'Logged by', 'Paid by', 'Category', 'Amount',
  'Note', 'Receipt', 'Posted', 'Entry ID'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('#,##0.00');
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
    const amount = Math.round(Number(d.amount) * 100) / 100;
    if (!(amount > 0 && amount < 1000000)) return json_({ ok: false, error: 'Amount is missing or too large.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) return json_({ ok: false, error: 'Date is missing.' });
    if (d.method !== 'cash' && d.method !== 'gcash') return json_({ ok: false, error: 'Choose Cash or Gcash.' });
    if (CATEGORIES.indexOf(d.category) < 0) return json_({ ok: false, error: 'Unknown category.' });
    if (PEOPLE.indexOf(d.by) < 0) return json_({ ok: false, error: 'Unknown name.' });
    const id = String(d.id || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
    if (!id) return json_({ ok: false, error: 'Missing entry id.' });

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
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
    return json_({ ok: false, error: 'Could not save. Try again.' });
  } finally {
    lock.releaseLock();
  }
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
