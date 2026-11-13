/**
 * Sumber service worker HyperFrames Studio (dilayani Worker di GET /sw.js).
 *
 * KEPUTUSAN:
 *  - Yang di-cache HANYA cangkang halaman ("/") dan tiga ikon kecil. Semua yang lain (POST /render,
 *    POST /asset, /status/:id, /video/:id, /api) tidak disentuh: SW tidak memanggil respondWith,
 *    jadi permintaan Range video dan polling status render langsung ke server seperti sebelumnya.
 *  - Navigasi ke "/" memakai network-first dengan batas waktu 4 dtk. Online: pengguna selalu
 *    mendapat halaman terbaru (dan salinan cache diperbarui). Offline atau jaringan lambat: cangkang
 *    terakhir dari cache dipakai, jadi riwayat, draf, dan Prompt Studio tetap bisa dibuka.
 *  - Halaman dibuat Worker dengan nonce CSP acak per respons. Salinan di cache menyimpan HTML dan
 *    header CSP-nya sekaligus, jadi nonce keduanya tetap cocok saat dipakai offline.
 *  - Permintaan "/" dari cache.put memakai header Accept: text/html, karena tanpa itu Worker
 *    membalas JSON info layanan (bukan halaman). Pencocokan cache memakai ignoreVary karena
 *    respons halaman memuat "Vary: accept".
 *  - skipWaiting + clients.claim: versi baru langsung aktif tanpa menunggu semua tab ditutup.
 *    Aman, sebab SW tidak menyimpan state dan halaman selalu diambil dari jaringan lebih dulu.
 *  - Naikkan VERSION bila logika atau daftar PRECACHE berubah (cache lama dihapus saat activate).
 *
 * ATURAN: tanpa backtick dan tanpa ${ di dalam String.raw ini.
 */
export const SW_SOURCE = String.raw`/* HyperFrames Studio service worker. Dibuat oleh Worker (src/pwa/service-worker.js). */
"use strict";

var VERSION = "1";
var CACHE_PREFIX = "hf-pwa-";
var CACHE = CACHE_PREFIX + VERSION;
var ORIGIN = self.location.origin;
var SHELL_URL = ORIGIN + "/";
var PRECACHE = ["/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
var NAV_TIMEOUT_MS = 4000;

var OFFLINE_HTML =
  '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="color-scheme" content="dark light"><meta name="robots" content="noindex">' +
  '<title>Offline \u00b7 HyperFrames Studio</title><style>' +
  'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;' +
  'background:#080D19;color:#e9eefb;font:16px/1.5 system-ui,sans-serif}' +
  'h1{margin:0 0 8px;font-size:22px}p{margin:0 auto;max-width:36ch;color:#9aa7c2}' +
  'a{display:inline-block;margin-top:20px;padding:12px 22px;border-radius:10px;background:#246BFD;' +
  'color:#fff;text-decoration:none;font-weight:600}' +
  '@media (prefers-color-scheme:light){body{background:#f3f6fc;color:#0f1730}p{color:#4a5876}}' +
  '</style></head><body><main><h1>Anda sedang offline</h1>' +
  '<p>Tampilan HyperFrames Studio belum tersimpan di perangkat ini. Hubungkan ke internet, lalu coba lagi.</p>' +
  '<a href="/">Coba lagi</a></main></body></html>';

function isHtml(res) {
  var type = res.headers.get("content-type") || "";
  return type.indexOf("text/html") >= 0;
}

// waitUntil hanya boleh dipanggil selama event masih aktif; kegagalan di sini tidak boleh merusak respons.
function keep(event, promise) {
  var safe = Promise.resolve(promise).catch(function () { /* diabaikan */ });
  try { event.waitUntil(safe); } catch (e) { /* event sudah selesai */ }
}

async function fetchShell() {
  var res = await fetch(new Request(SHELL_URL, { headers: { accept: "text/html" }, cache: "no-store" }));
  if (!res.ok || !isHtml(res)) throw new Error("shell_unavailable");
  return res;
}

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'"
    }
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    // Semua precache bersifat terbaik-usaha: kegagalan satu aset tidak boleh membatalkan instalasi.
    await Promise.all(PRECACHE.map(function (path) {
      return cache.add(path).catch(function () { /* diabaikan */ });
    }));
    try { await cache.put(SHELL_URL, await fetchShell()); } catch (e) { /* diabaikan */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var names = await caches.keys();
    await Promise.all(names.filter(function (name) {
      return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE;
    }).map(function (name) { return caches.delete(name); }));
    await self.clients.claim();
  })());
});

async function handleNavigate(event) {
  var cache = await caches.open(CACHE);
  var network = fetch(event.request).then(function (res) {
    // Hanya halaman sukses yang disimpan; salinan dibuat sebelum badan respons dipakai halaman.
    if (res && res.ok && isHtml(res)) keep(event, cache.put(SHELL_URL, res.clone()));
    return res;
  });
  var timer;
  var timeout = new Promise(function (resolve, reject) {
    timer = setTimeout(function () { reject(new Error("nav_timeout")); }, NAV_TIMEOUT_MS);
  });
  try {
    var res = await Promise.race([network, timeout]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    var cached = await cache.match(SHELL_URL, { ignoreVary: true });
    if (cached) {
      keep(event, network); // biarkan permintaan jaringan selesai agar cache diperbarui
      return cached;
    }
    // Belum ada cache: tunggu jaringan apa adanya; bila gagal, tampilkan halaman offline.
    try { return await network; } catch (err2) { return offlineResponse(); }
  }
}

async function handleStatic(event) {
  var cache = await caches.open(CACHE);
  var cached = await cache.match(event.request);
  if (cached) return cached;
  var res = await fetch(event.request);
  if (res && res.ok) keep(event, cache.put(event.request, res.clone()));
  return res;
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== ORIGIN) return;
  if (req.mode === "navigate" && url.pathname === "/") {
    event.respondWith(handleNavigate(event));
    return;
  }
  if (PRECACHE.indexOf(url.pathname) >= 0) {
    event.respondWith(handleStatic(event));
  }
  // Selain itu (API, status, video, aset) tidak disentuh: langsung ke jaringan.
});
`;
