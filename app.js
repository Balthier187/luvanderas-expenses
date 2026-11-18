(function () {
  "use strict";
  var CFG = window.LUV_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var peso = function (n) { return "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 }); };
  var manilaToday = function () {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  };
  var fmtDay = function (d) { return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }); };

  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var me = load("luv_me", null);
  if (me && CFG.PEOPLE.indexOf(me) < 0) me = null;
  var sent = load("luv_sent", []);
  var counts = load("luv_counts", []);
  var tab = load("luv_tab", "exp") === "count" ? "count" : "exp";
  var ITEMS = CFG.ITEMS || [];
  var photoB64 = null, busy = false;

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function setStatus(t, err) { $("status").textContent = t || ""; $("status").classList.toggle("err", !!err); }
  function banner(t) { $("banner").textContent = t || ""; $("banner").hidden = !t; }

  // People and categories
  $("people").innerHTML = "";
  CFG.PEOPLE.forEach(function (p) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = p;
    b.addEventListener("click", function () { me = p; save("luv_me", p); showForm(); });
    $("people").appendChild(b);
  });
  $("cats").innerHTML = CFG.CATEGORIES.map(function (c, i) {
    return '<label class="chip"><input type="radio" name="cat" id="cat' + i + '" value="' + c.replace(/"/g, "&quot;") + '"' + (i === 0 ? " checked" : "") + "><span></span></label>";
  }).join("");
  CFG.CATEGORIES.forEach(function (c, i) { $("cat" + i).nextElementSibling.textContent = c; });

  function showForm() {
    $("pick").hidden = !!me; $("whoLine").hidden = !me; $("tabs").hidden = !me;
    $("form").hidden = !me || tab !== "exp"; $("countForm").hidden = !me || tab !== "count";
    $("tabExp").setAttribute("aria-selected", tab === "exp"); $("tabCount").setAttribute("aria-selected", tab === "count");
    if (me) $("whoName").textContent = me;
  }
  $("tabExp").addEventListener("click", function () { tab = "exp"; save("luv_tab", tab); showForm(); });
  $("tabCount").addEventListener("click", function () { tab = "count"; save("luv_tab", tab); showForm(); });

  // Stock count rows
  ITEMS.forEach(function (it, i) {
    var row = document.createElement("div"); row.className = "srow";
    var nm = document.createElement("div"); nm.className = "nm"; nm.textContent = it[0];
    if (it[1]) { var sm = document.createElement("small"); sm.textContent = it[1] + " per case"; nm.appendChild(sm); }
    var ins = document.createElement("div"); ins.className = "ins";
    if (it[1]) ins.innerHTML += '<input id="cs' + i + '" inputmode="numeric" placeholder="0" aria-label="' + it[0] + ' full cases"><span class="unit">cases</span>';
    ins.innerHTML += '<input id="ls' + i + '" inputmode="numeric" placeholder="0" aria-label="' + it[0] + ' loose pieces"><span class="unit">loose</span>';
    var tot = document.createElement("div"); tot.className = "tot num"; tot.id = "tt" + i;
    row.append(nm, ins, tot); $("stock").appendChild(row);
  });
  function readCount(i) {
    var c = $("cs" + i), l = $("ls" + i);
    var cv = c ? c.value.trim() : "", lv = l.value.trim();
    if (cv === "" && lv === "") return null;
    var cases = parseInt(cv || "0", 10), loose = parseInt(lv || "0", 10);
    return { item: ITEMS[i][0], cases: cases, loose: loose, total: cases * ITEMS[i][1] + loose };
  }
  $("stock").addEventListener("input", function (e) {
    if (e.target.tagName !== "INPUT") return;
    e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    var i = e.target.id.slice(2), r = readCount(i);
    $("tt" + i).textContent = r && ITEMS[i][1] ? "= " + r.total.toLocaleString("en-PH") + " pieces" : "";
  });
  $("countForm").addEventListener("submit", function (e) {
    e.preventDefault(); if (busy) return;
    var date = $("countDate").value, lines = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > manilaToday()) { cStatus("Pick today's date or an earlier one.", true); return; }
    ITEMS.forEach(function (_, i) { var r = readCount(i); if (r) lines.push(r); });
    if (!lines.length) { cStatus("Enter at least one count.", true); return; }
    if (!CFG.SCRIPT_URL) { cStatus("This site isn't connected to the Google Sheet yet. Tell Evan.", true); return; }
    var id = $("countForm").dataset.pendingId || uid(); $("countForm").dataset.pendingId = id;
    busy = true; $("countBtn").disabled = true; cStatus("Sending…");
    var body = { type: "count", id: id, date: date, by: me, note: $("countNote").value.trim().slice(0, 300),
      items: lines.map(function (l) { return { item: l.item, cases: l.cases, loose: l.loose }; }) };
    fetch(CFG.SCRIPT_URL, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "Not saved.");
        counts.push({ date: date, by: me, n: lines.length, at: Date.now() }); if (counts.length > 100) counts = counts.slice(-100); save("luv_counts", counts);
        delete $("countForm").dataset.pendingId;
        $("countForm").reset(); $("countDate").value = date;
        ITEMS.forEach(function (_, i) { $("tt" + i).textContent = ""; });
        cStatus("Sent count of " + lines.length + " item" + (lines.length > 1 ? "s" : "") + " for " + fmtDay(date) + ".");
        render();
      })
      .catch(function (err) {
        cStatus((err && err.message && err.message !== "Failed to fetch" ? err.message + " " : "") + "Not sent. Check your signal and press Send again.", true);
      })
      .then(function () { busy = false; $("countBtn").disabled = false; });
  });
  function cStatus(t, err) { $("countStatus").textContent = t || ""; $("countStatus").classList.toggle("err", !!err); }
  $("switchWho").addEventListener("click", function () { me = null; save("luv_me", null); showForm(); });

  function render() {
    var today = manilaToday(), c = 0, g = 0;
    sent.forEach(function (r) { if (r.date === today) { if (r.method === "cash") c += r.amount; else g += r.amount; } });
    $("tCash").textContent = peso(c); $("tGcash").textContent = peso(g);
    $("todayLabel").textContent = fmtDay(today);
    var recent = sent.map(function (r) { return { k: "e", r: r, t: r.t || 0 }; })
      .concat(counts.map(function (c) { return { k: "c", r: c, t: c.at }; }));
    recent = recent.map(function (x, i) { x.i = i; return x; });
    recent.sort(function (a, b) { return (a.t - b.t) || (a.i - b.i); });
    recent = recent.slice(-30).reverse();
    if (!recent.length) {
      $("list").innerHTML = '<div class="empty">Expenses and counts you send appear here. Evan sees everyone\'s in the Google Sheet.</div>';
      return;
    }
    var box = document.createElement("div"); box.className = "items";
    recent.forEach(function (x) {
      var r = x.r;
      var row = document.createElement("div"); row.className = "item"; row.style.cursor = "default";
      if (x.k === "c") {
        row.innerHTML = '<span class="dot" style="background:var(--muted)" aria-hidden="true"></span><span class="what"><b></b><small></small></span><span class="amt"></span>';
        row.querySelector("b").textContent = "Stock count · " + r.n + " item" + (r.n > 1 ? "s" : "");
        row.querySelector("small").textContent = fmtDay(r.date) + " · " + r.by;
        box.appendChild(row); return;
      }
      row.innerHTML = '<span class="dot ' + (r.method === "cash" ? "cash" : "gcash") + '" aria-hidden="true"></span><span class="what"><b></b><small></small></span><span class="amt num"><span></span></span>';
      row.querySelector("b").textContent = r.note || r.category;
      row.querySelector("small").textContent = fmtDay(r.date) + " · " + (r.method === "cash" ? "Cash" : "Gcash") + " · " + r.category + " · " + r.by;
      row.querySelector(".amt span").textContent = peso(r.amount);
      if (r.photo) { var t = document.createElement("span"); t.className = "tag cam"; t.textContent = "Receipt"; row.querySelector(".amt").appendChild(t); }
      box.appendChild(row);
    });
    $("list").replaceChildren(box);
  }

  // Photo: shrink on the phone before sending
  $("photoBtn").addEventListener("click", function () { $("photoInput").click(); });
  $("photoInput").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var max = 1200, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      var data = cv.toDataURL("image/jpeg", 0.75);
      photoB64 = data.split(",")[1];
      $("photoPrev").src = data; $("photoPrev").hidden = false; $("photoBtn").textContent = "Replace photo";
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { setStatus("That photo couldn't be read. Try another one.", true); URL.revokeObjectURL(url); };
    img.src = url;
  });

  $("amount").addEventListener("input", function (e) {
    var v = e.target.value.replace(/[^0-9.]/g, ""), p = v.split(".");
    e.target.value = p.length > 2 ? p[0] + "." + p.slice(1).join("") : v;
  });

  $("form").addEventListener("submit", function (e) {
    e.preventDefault(); if (busy) return;
    var amount = Math.round(parseFloat($("amount").value) * 100) / 100;
    if (!(amount > 0)) { setStatus("Enter the amount spent.", true); $("amount").focus(); return; }
    var date = $("date").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setStatus("Pick a date.", true); return; }
    if (date > manilaToday()) { setStatus("The date can't be in the future.", true); return; }
    if (!CFG.SCRIPT_URL) { setStatus("This site isn't connected to the Google Sheet yet. Tell Evan.", true); return; }
    var entry = {
      id: $("form").dataset.pendingId || uid(), date: date, amount: amount, by: me,
      method: document.querySelector("input[name=method]:checked").value,
      category: document.querySelector("input[name=cat]:checked").value,
      note: $("note").value.trim().slice(0, 300)
    };
    $("form").dataset.pendingId = entry.id; // same id if they press Send again after an error
    busy = true; $("saveBtn").disabled = true; setStatus(photoB64 ? "Sending with photo…" : "Sending…");
    var body = JSON.parse(JSON.stringify(entry)); if (photoB64) body.photo = photoB64;
    fetch(CFG.SCRIPT_URL, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "Not saved.");
        entry.photo = !!photoB64; entry.t = Date.now(); sent.push(entry); if (sent.length > 200) sent = sent.slice(-200); save("luv_sent", sent);
        delete $("form").dataset.pendingId;
        var keepMethod = entry.method;
        $("form").reset(); $("date").value = date; $(keepMethod === "cash" ? "mCashR" : "mGcashR").checked = true; $("cat0").checked = true;
        photoB64 = null; $("photoPrev").hidden = true; $("photoBtn").textContent = "Add photo";
        setStatus("Sent " + peso(amount) + " " + (keepMethod === "cash" ? "cash" : "Gcash") + " for " + fmtDay(date) + ".");
        render();
      })
      .catch(function (err) {
        setStatus((err && err.message && err.message !== "Failed to fetch" ? err.message + " " : "") + "Not sent. Check your signal and press Send again.", true);
      })
      .then(function () { busy = false; $("saveBtn").disabled = false; });
  });

  $("date").value = manilaToday(); $("countDate").value = manilaToday();
  if (!CFG.SCRIPT_URL) banner("Not connected to the Google Sheet yet. Expenses can't be sent until Evan finishes setup.");
  showForm(); render();
})();
