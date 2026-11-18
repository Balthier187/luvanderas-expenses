# Luvanderas Expenses

A phone website where the Luvanderas team logs shop expenses (cash or Gcash, category, amount, note, receipt photo).

- **Website:** hosted free on GitHub Pages from this repository.
- **Data:** each expense is sent to a Google Sheet that Evan owns (tab `Expenses`). Receipt photos go to the Drive folder `Luvanderas receipts`. No expense data is stored in this repository.
- **Google side:** `google-script/Code.gs` is pasted into the Sheet's Extensions > Apps Script and deployed as a Web app. Its URL goes in `config.js` as `SCRIPT_URL`.
- **Names and categories:** edit `PEOPLE` and `CATEGORIES` in both `config.js` and `Code.gs` so they match.
- **Bookkeeping:** during "update", Claude reads the Sheet, posts rows with an empty `Posted` column into the MONEY workbook, then marks them posted.
