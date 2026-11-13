/**
 * Bagian halaman web untuk PWA: tag <head>, CSS, dan skrip klien.
 *
 * Semuanya disisipkan Worker ke halaman GET / oleh decorateShell (lihat ./index.js), jadi
 * ui/markup.js, ui/styles.js, dan page.js tidak diubah.
 *
 * KEPUTUSAN:
 *  - Skrip klien mandiri (satu IIFE, tanpa memanggil fungsi skrip utama), jadi tidak rusak bila
 *    skrip utama dibungkus/diubah. Ia hanya bergantung pada DOM: #v-dashboard .view-h,
 *    #v-settings .set-grid, #main, #toasts, dan sprite ikon (#i-download, #i-alert, #i-x).
 *    Bila salah satu tidak ada, bagian itu dilewati tanpa galat.
 *  - Event beforeinstallprompt didaftarkan saat skrip dijalankan (bukan menunggu DOM siap),
 *    supaya tidak terlewat. Event itu ditahan lalu dipakai tombol "Instal" (sekali pakai).
 *  - Android/Chrome: tombol instal hanya muncul bila Chrome benar-benar menawarkannya. Bila tidak
 *    (sudah terpasang, atau Chrome belum menganggap layak), kartu Pengaturan menampilkan langkah manual.
 *  - Status offline hanya penanda tampilan (navigator.onLine); tidak memblokir aksi apa pun.
 *
 * ATURAN: tanpa backtick dan tanpa ${ di dalam String.raw; tanpa "</script" dan "<!--".
 */

export const HEAD_TAGS =
  '<link rel="manifest" href="/manifest.webmanifest">' +
  '<link rel="icon" href="/icon.svg" type="image/svg+xml">' +
  '<link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192">' +
  '<meta name="application-name" content="HyperFrames Studio">';

export const CLIENT_CSS = String.raw`
/* ============ PWA ============ */
.offline-bar{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding:10px 14px;border-radius:12px;border:1px solid var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:var(--warn-soft);color:var(--warn);font-size:13.5px;font-weight:600;line-height:1.45}
.offline-bar .i{flex:none}
.pwa-banner{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-color:var(--acc);border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}
.pwa-banner>.i{width:26px;height:26px;color:var(--acc-t)}
.pwa-banner .pb-t{flex:1 1 220px;min-width:0}
.pwa-banner .pb-t b{display:block;font-size:15px}
.pwa-banner .pb-t p{margin-top:2px;color:var(--mut);font-size:13px;line-height:1.5}
.pwa-banner .actions{flex:none}
.pwa-steps{margin:10px 0 0;padding-left:20px}
.pwa-steps li{margin:2px 0}
@media (display-mode: standalone){html,body{overscroll-behavior-y:contain}}
`;

export const CLIENT_SOURCE = String.raw`(function () {
  "use strict";

  var DISMISS_KEY = "hf_pwa_dismissed";
  var DISMISS_MS = 14 * 24 * 60 * 60 * 1000;   // banner Dashboard muncul lagi setelah 14 hari
  var deferred = null;        // event beforeinstallprompt yang ditahan (hanya bisa dipakai sekali)
  var installed = false;      // true setelah appinstalled pada sesi ini
  var swState = "checking";   // checking | active | unsupported | error
  var wasOffline = false;
  var ui = {};                // elemen yang dibuat skrip ini

  /* ---------- util kecil ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function icon(name) {
    var NS = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("class", "i");
    s.setAttribute("aria-hidden", "true");
    var u = document.createElementNS(NS, "use");
    u.setAttribute("href", "#i-" + name);
    s.appendChild(u);
    return s;
  }
  function button(label, cls, onClick) {
    var b = el("button", "btn" + (cls ? " " + cls : ""));
    b.type = "button";
    if (label) b.appendChild(el("span", null, label));
    b.addEventListener("click", onClick);
    return b;
  }
  function read(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* mode privat */ } }
  function toast(text, kind) {
    var box = $("toasts");
    if (!box) return;
    var t = el("div", "toast" + (kind ? " " + kind : ""), text);
    t.setAttribute("role", kind === "err" ? "alert" : "status");
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, kind === "err" ? 6500 : 3200);
  }

  function isStandalone() {
    try {
      var modes = ["standalone", "minimal-ui", "fullscreen"];
      for (var i = 0; i < modes.length; i++) {
        if (window.matchMedia("(display-mode: " + modes[i] + ")").matches) return true;
      }
    } catch (e) { /* abaikan */ }
    return window.navigator.standalone === true;
  }
  function dismissedRecently() {
    var t = Number(read(DISMISS_KEY));
    return isFinite(t) && t > 0 && Date.now() - t < DISMISS_MS;
  }

  /* ---------- tampilan ---------- */
  function refresh() {
    var standalone = isStandalone();
    var canInstall = !!deferred && !standalone && !installed;

    if (ui.banner) ui.banner.hidden = !(canInstall && !dismissedRecently());
    if (!ui.card) return;

    ui.install.hidden = !canInstall;
    ui.steps.hidden = standalone || installed || canInstall || swState === "unsupported";

    var text;
    if (standalone) {
      text = "Anda membuka HyperFrames sebagai aplikasi. Tampilan, riwayat, dan draf tetap bisa dibuka saat offline; render dan unggah aset tetap butuh internet.";
    } else if (installed) {
      text = "Aplikasi terpasang. Buka lewat ikon HyperFrames di layar utama atau laci aplikasi Android.";
    } else if (canInstall) {
      text = "Pasang HyperFrames di layar utama Android: buka dengan satu ketukan, tampil layar penuh, dan antarmuka tetap bisa dibuka saat offline.";
    } else if (swState === "unsupported") {
      text = "Browser ini belum mendukung pemasangan aplikasi (butuh HTTPS dan service worker). Gunakan Chrome di Android.";
    } else {
      text = "Dialog pemasangan belum tersedia di browser ini. Ikuti langkah manual di bawah. Bila aplikasi sudah terpasang, buka lewat ikonnya di layar utama.";
    }
    ui.text.textContent = text;

    ui.stMode.textContent = standalone ? "Aplikasi (tanpa bilah browser)" : "Tab browser";
    ui.stSw.textContent = swState === "active" ? "Aktif"
      : swState === "checking" ? "Menyiapkan\u2026"
      : swState === "unsupported" ? "Tidak didukung browser ini"
      : "Gagal diaktifkan";
    ui.stNet.textContent = window.navigator.onLine === false ? "Offline" : "Online";
  }

  function updateNet(fromEvent) {
    var off = window.navigator.onLine === false;
    if (ui.bar) ui.bar.hidden = !off;
    if (fromEvent && wasOffline && !off) toast("Kembali online.", "ok");
    wasOffline = off;
    refresh();
  }

  function stateRow(label) {
    var row = el("div", "stor");
    row.appendChild(el("span", null, label));
    var val = el("b");
    row.appendChild(val);
    return { row: row, val: val };
  }

  function buildOfflineBar() {
    var main = $("main");
    if (!main) return;
    var bar = el("div", "offline-bar");
    bar.id = "offlineBar";
    bar.setAttribute("role", "status");
    bar.hidden = true;
    bar.appendChild(icon("alert"));
    bar.appendChild(el("span", null, "Anda sedang offline. Riwayat dan draf tetap bisa dilihat; render dan unggah aset butuh internet."));
    main.insertBefore(bar, main.firstChild);
    ui.bar = bar;
  }

  function buildBanner() {
    var dash = $("v-dashboard");
    var anchor = dash && dash.querySelector(".view-h");
    if (!anchor) return;
    var banner = el("section", "card pwa-banner");
    banner.id = "pwaBanner";
    banner.setAttribute("aria-label", "Pasang aplikasi");
    banner.hidden = true;
    banner.appendChild(icon("download"));
    var t = el("div", "pb-t");
    t.appendChild(el("b", null, "Pasang HyperFrames di Android"));
    t.appendChild(el("p", null, "Buka cepat dari layar utama, tampil layar penuh, dan tetap bisa dibuka saat offline."));
    banner.appendChild(t);
    var acts = el("div", "actions");
    acts.appendChild(button("Instal", "solid", install));
    var close = button("", "ghost sm icon", dismiss);
    close.setAttribute("aria-label", "Sembunyikan ajakan pasang aplikasi");
    close.title = "Sembunyikan";
    close.appendChild(icon("x"));
    acts.appendChild(close);
    banner.appendChild(acts);
    anchor.insertAdjacentElement("afterend", banner);
    ui.banner = banner;
  }

  function buildCard() {
    var grid = document.querySelector("#v-settings .set-grid");
    var col = grid && grid.firstElementChild;
    if (!col) return;
    var card = el("section", "card");
    card.id = "pwaCard";
    card.appendChild(el("h2", "h2", "Aplikasi Android (PWA)"));
    ui.text = el("p", "hint");
    card.appendChild(ui.text);

    var acts = el("div", "actions mt-s");
    ui.install = button("Instal aplikasi", "solid", install);
    ui.install.insertBefore(icon("download"), ui.install.firstChild);
    ui.install.hidden = true;
    acts.appendChild(ui.install);
    card.appendChild(acts);

    ui.steps = el("ol", "hint pwa-steps");
    ui.steps.hidden = true;
    [
      "Buka halaman ini di Chrome (Android).",
      "Ketuk menu \u22ee di pojok kanan atas.",
      "Pilih Instal aplikasi atau Tambahkan ke layar utama.",
      "Konfirmasi, lalu buka HyperFrames dari layar utama."
    ].forEach(function (s) { ui.steps.appendChild(el("li", null, s)); });
    card.appendChild(ui.steps);

    var mode = stateRow("Mode tampilan");
    var sw = stateRow("Mode offline (service worker)");
    var net = stateRow("Koneksi");
    ui.stMode = mode.val;
    ui.stSw = sw.val;
    ui.stNet = net.val;
    var list = el("div", "mt");
    list.appendChild(mode.row);
    list.appendChild(sw.row);
    list.appendChild(net.row);
    card.appendChild(list);

    col.insertBefore(card, col.firstChild);
    ui.card = card;
  }

  /* ---------- aksi ---------- */
  function install() {
    var ev = deferred;
    if (!ev) {
      toast("Dialog pemasangan belum tersedia. Pakai menu Chrome (\u22ee) lalu Instal aplikasi.", "warn");
      return;
    }
    deferred = null;          // event beforeinstallprompt hanya bisa dipakai sekali
    refresh();
    var shown;
    try { shown = ev.prompt(); } catch (e) { toast("Gagal menampilkan dialog pemasangan.", "err"); return; }
    Promise.resolve(shown).then(function () { return ev.userChoice; }).then(function (choice) {
      if (choice && choice.outcome === "accepted") {
        toast("Memasang aplikasi\u2026", "ok");
      } else {
        write(DISMISS_KEY, String(Date.now()));
        toast("Pemasangan dibatalkan. Bisa diulang dari menu Chrome.", "warn");
      }
    }).catch(function () {
      toast("Gagal memasang aplikasi.", "err");
    }).then(refresh);
  }
  function dismiss() {
    write(DISMISS_KEY, String(Date.now()));
    refresh();
  }

  function registerSw() {
    if (!("serviceWorker" in window.navigator) || !window.isSecureContext) {
      swState = "unsupported";
      refresh();
      return;
    }
    function start() {
      window.navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(function () { return window.navigator.serviceWorker.ready; })
        .then(function () { swState = "active"; refresh(); })
        .catch(function () { swState = "error"; refresh(); });
    }
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  }

  /* ---------- pemasangan: daftarkan listener sekarang agar event tidak terlewat ---------- */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    refresh();
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    installed = true;
    toast("HyperFrames terpasang. Buka dari layar utama.", "ok");
    refresh();
  });
  window.addEventListener("online", function () { updateNet(true); });
  window.addEventListener("offline", function () { updateNet(true); });
  try {
    var mq = window.matchMedia("(display-mode: standalone)");
    if (mq && mq.addEventListener) mq.addEventListener("change", refresh);
  } catch (e) { /* abaikan */ }

  function init() {
    try { buildOfflineBar(); } catch (e) { /* bagian ini opsional */ }
    try { buildBanner(); } catch (e) { /* bagian ini opsional */ }
    try { buildCard(); } catch (e) { /* bagian ini opsional */ }
    updateNet(false);
    registerSw();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
`;
