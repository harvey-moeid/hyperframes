/**
 * hyperframes-render — Cloudflare Worker (paket Workers Free).
 *
 * Peran Worker ini sengaja kecil: ia TIDAK merender apa pun. Render dilakukan
 * oleh GitHub Actions (.github/workflows/render-video.yml); Worker hanya
 *   1. menerima permintaan render (POST /render, dilindungi x-api-key),
 *   2. memicu repository_dispatch (event: render-video) ke repo fork,
 *   3. menyajikan hasil MP4 dari R2 (GET /video/:id) dan statusnya (GET /status/:id),
 *   4. menyajikan halaman web (GET /) untuk memakai ketiganya dari browser.
 *
 * Routing GET /:
 *   - browser (header Accept memuat text/html) -> halaman web
 *   - selain itu (curl, skrip)                 -> JSON info layanan (perilaku lama)
 *   - GET /api selalu JSON info layanan
 *
 * Binding & secret (lihat wrangler.jsonc):
 *   env.VIDEOS       R2 bucket "hyperframes-renders"
 *   env.GITHUB_REPO  var "owner/repo" tujuan dispatch
 *   env.GITHUB_TOKEN secret, PAT fine-grained (Contents: Read and write)
 *   env.API_KEY      secret, kunci untuk POST /render
 *
 * Kunci objek di R2 HARUS sama dengan yang dipakai workflow: renders/<id>.mp4
 */

// Aturan input yang sama dipakai ulang di workflow (validasi dua lapis).
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const QUALITIES = new Set(["draft", "standard", "high"]);
const DEFAULT_COMPOSITION = "contoh";
const MAX_BODY_BYTES = 2048; // body /render hanya JSON kecil

const objectKey = (id) => `renders/${id}.mp4`;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Respons JSON (termasuk 404 "belum selesai") tidak boleh di-cache.
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

const methodNotAllowed = (allowed) =>
  json({ error: "method_not_allowed" }, 405, { allow: allowed.join(", ") });

/**
 * Bandingkan dua string tanpa membocorkan panjang/isi lewat waktu respons.
 * Keduanya di-hash SHA-256 dulu supaya panjangnya sama, lalu dibandingkan
 * dengan crypto.subtle.timingSafeEqual (tersedia di Workers runtime).
 */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      // Log pesan saja; jangan pernah mencetak env/secret/header.
      console.error("unhandled", err instanceof Error ? err.message : String(err));
      return json({ error: "internal_error" }, 500);
    }
  },
};

const serviceInfo = () =>
  json(
    {
      service: "hyperframes-render",
      endpoints: ["POST /render", "GET /status/:id", "GET /video/:id"],
    },
    200,
    { vary: "accept" },
  );

/** Browser mengirim Accept yang memuat text/html; curl/skrip biasanya tidak. */
const wantsHtml = (request) => (request.headers.get("accept") ?? "").includes("text/html");

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/render") {
    if (method !== "POST") return methodNotAllowed(["POST"]);
    return handleRender(request, env, url.origin);
  }

  const match = pathname.match(/^\/(status|video)\/([^/]+)$/);
  if (match) {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    let id;
    try {
      id = decodeURIComponent(match[2]);
    } catch {
      return json({ error: "invalid_id" }, 400);
    }
    if (!ID_RE.test(id)) return json({ error: "invalid_id" }, 400);
    return match[1] === "status"
      ? handleStatus(env, id, url.origin)
      : handleVideo(request, env, id);
  }

  if (pathname === "/") {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    return wantsHtml(request) ? htmlPage() : serviceInfo();
  }

  if (pathname === "/api") {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    return serviceInfo();
  }

  return json({ error: "not_found" }, 404);
}

/** POST /render  body: { id?, composition?, quality? } → 202 */
async function handleRender(request, env, origin) {
  if (!env.API_KEY || !env.GITHUB_TOKEN || !REPO_RE.test(env.GITHUB_REPO ?? "")) {
    return json({ error: "server_not_configured" }, 500);
  }

  const provided = request.headers.get("x-api-key") ?? "";
  if (!(await safeEqual(provided, env.API_KEY))) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "body_too_large" }, 413);
  }
  let body = {};
  if (raw.trim() !== "") {
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_json" }, 400);
  }

  // id otomatis berupa UUID (tak mudah ditebak) bila tidak diberikan.
  const id = body.id ?? crypto.randomUUID();
  const composition = body.composition ?? DEFAULT_COMPOSITION;
  const quality = body.quality ?? "standard";

  if (typeof id !== "string" || !ID_RE.test(id)) return json({ error: "invalid_id" }, 400);
  if (typeof composition !== "string" || !ID_RE.test(composition)) {
    return json({ error: "invalid_composition" }, 400);
  }
  if (typeof quality !== "string" || !QUALITIES.has(quality)) {
    return json({ error: "invalid_quality", allowed: [...QUALITIES] }, 400);
  }

  // Jangan menimpa hasil yang sudah ada.
  if (await env.VIDEOS.head(objectKey(id))) {
    return json({ error: "id_already_exists", id }, 409);
  }

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "hyperframes-render-worker", // wajib untuk GitHub API
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "render-video",
      client_payload: { id, composition, quality },
    }),
  });

  // GitHub membalas 204 No Content bila dispatch diterima.
  if (res.status !== 204) {
    const detail = (await res.text()).slice(0, 200);
    console.error("dispatch_failed", res.status, detail);
    return json({ error: "dispatch_failed", github_status: res.status }, 502);
  }

  return json(
    {
      id,
      composition,
      quality,
      status: "queued",
      status_url: `${origin}/status/${id}`,
      video_url: `${origin}/video/${id}`,
    },
    202,
  );
}

/** GET /status/:id — hanya cek keberadaan file di R2. */
async function handleStatus(env, id, origin) {
  const head = await env.VIDEOS.head(objectKey(id));
  if (!head) {
    // Tidak bisa membedakan "antre/sedang render" dari "id tidak pernah ada".
    return json({ id, status: "not_ready" }, 404);
  }
  return json({
    id,
    status: "done",
    size: head.size,
    uploaded: head.uploaded.toISOString(),
    video_url: `${origin}/video/${id}`,
  });
}

/** GET|HEAD /video/:id — sajikan MP4 dari R2 (404 selama belum selesai). */
async function handleVideo(request, env, id) {
  const key = objectKey(id);
  const isHead = request.method === "HEAD";

  // `range: request.headers` membuat R2 menangani header Range sehingga
  // pemutar video bisa seek (respons 206).
  const object = isHead
    ? await env.VIDEOS.head(key)
    : await env.VIDEOS.get(key, { range: request.headers });
  if (!object) return json({ id, error: "not_ready" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-type", "video/mp4");
  headers.set("accept-ranges", "bytes");
  // id tidak pernah ditimpa lewat API (409), jadi aman di-cache sejam.
  headers.set("cache-control", "public, max-age=3600");

  if (isHead) {
    headers.set("content-length", String(object.size));
    return new Response(null, { status: 200, headers });
  }

  let status = 200;
  if (object.range) {
    status = 206;
    headers.set("content-range", contentRange(object.range, object.size));
  }
  return new Response(object.body, { status, headers });
}

/** Bangun header Content-Range dari R2Range (offset/length atau suffix). */
function contentRange(range, size) {
  let start;
  let end;
  if (range.suffix !== undefined) {
    start = Math.max(size - range.suffix, 0);
    end = size - 1;
  } else {
    start = range.offset ?? 0;
    end = range.length !== undefined ? Math.min(start + range.length, size) - 1 : size - 1;
  }
  return `bytes ${start}-${end}/${size}`;
}

/* ------------------------------------------------------------------ *
 * Halaman web (GET /)
 *
 * Satu halaman statis tanpa dependensi eksternal. Script & style inline
 * dilindungi CSP berbasis nonce acak per respons; semua data dari server
 * dimasukkan ke DOM lewat textContent (tidak ada innerHTML).
 * ------------------------------------------------------------------ */

function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function htmlPage() {
  const nonce = makeNonce();
  const body = PAGE_HTML.split("__NONCE__").join(nonce);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      vary: "accept",
      "content-security-policy":
        "default-src 'none'; " +
        `script-src 'nonce-${nonce}'; ` +
        `style-src 'nonce-${nonce}'; ` +
        "connect-src 'self'; media-src 'self'; img-src 'self' data:; " +
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  });
}

// String.raw: backslash apa adanya. JANGAN pakai backtick atau ${ di dalam blok ini.
const PAGE_HTML = String.raw`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="robots" content="noindex">
<title>HyperFrames Render</title>
<style nonce="__NONCE__">
:root{
  --bg:#0b0f17;--panel:#121826;--panel2:#182033;--line:#243049;
  --text:#e6ebf5;--mut:#93a0b8;--acc:#5b8cff;--acc-h:#7aa1ff;--on-acc:#071029;
  --ok:#34d399;--warn:#fbbf24;--err:#f87171;--r:12px;
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#f4f6fb;--panel:#ffffff;--panel2:#eef2fa;--line:#d9dfec;
    --text:#141a2a;--mut:#5b6784;--acc:#2f5fe0;--acc-h:#2450c8;--on-acc:#ffffff;
    --ok:#0f8a5f;--warn:#a86a0a;--err:#c93a3a;
  }
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);
  font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
main{max-width:760px;margin:0 auto;padding:20px 16px 48px}
header{margin:8px 0 20px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:.2px}
header p{margin:0;color:var(--mut)}
.card{
  background:var(--panel);border:1px solid var(--line);border-radius:var(--r);
  padding:16px;margin:0 0 16px;
}
.card h2{font-size:15px;margin:0 0 12px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:560px){.grid{grid-template-columns:1fr}}
.field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
.field.full{grid-column:1/-1}
label{font-size:13px;color:var(--mut)}
input,select,button{font:inherit;color:inherit}
input[type=text],input[type=password],select{
  width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);color:var(--text);min-height:42px;
}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{
  outline:2px solid var(--acc);outline-offset:2px;
}
.row{display:flex;gap:8px}
.row>input{flex:1;min-width:0}
.hint{font-size:12px;color:var(--mut);margin:0}
.check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mut);margin:0 0 12px}
.check input{width:16px;height:16px;margin:0}
button{
  cursor:pointer;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);padding:10px 14px;min-height:42px;
}
button:hover:not(:disabled){border-color:var(--acc)}
button:disabled{opacity:.55;cursor:not-allowed}
button.primary{background:var(--acc);border-color:var(--acc);color:var(--on-acc);font-weight:600}
button.primary:hover:not(:disabled){background:var(--acc-h);border-color:var(--acc-h)}
button.small{min-height:34px;padding:6px 10px;font-size:13px}
button.danger:hover:not(:disabled){border-color:var(--err);color:var(--err)}
.msg{margin:12px 0 0;padding:10px 12px;border-radius:8px;font-size:14px;border:1px solid var(--line);background:var(--panel2)}
.msg.err{border-color:var(--err);color:var(--err)}
.msg.ok{border-color:var(--ok);color:var(--ok)}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.badge{
  display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;
  font-size:13px;font-weight:600;border:1px solid var(--line);background:var(--panel2);
}
.badge.run{color:var(--warn);border-color:var(--warn)}
.badge.done{color:var(--ok);border-color:var(--ok)}
.badge.bad{color:var(--err);border-color:var(--err)}
.spin{width:10px;height:10px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.spin{animation:none}}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 12px;font-size:14px}
.kv dt{color:var(--mut)}
.kv dd{margin:0;word-break:break-all}
code{font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
video{width:100%;max-height:70vh;background:#000;border-radius:8px;display:block;margin:0 0 12px}
.actions{display:flex;flex-wrap:wrap;gap:8px}
a.btn{
  display:inline-flex;align-items:center;text-decoration:none;color:inherit;
  border:1px solid var(--line);background:var(--panel2);border-radius:8px;padding:8px 14px;min-height:42px;
}
a.btn:hover{border-color:var(--acc)}
ul.hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
ul.hist li{
  display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;
  padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);
}
.h-info{min-width:0;flex:1 1 220px}
.h-info code{display:block;word-break:break-all}
.h-meta{font-size:12px;color:var(--mut)}
.h-btns{display:flex;gap:6px}
.empty{color:var(--mut);margin:0;font-size:14px}
details summary{cursor:pointer;color:var(--mut);font-size:14px}
details p{font-size:13px;color:var(--mut);margin:8px 0 0}
footer{color:var(--mut);font-size:12px;text-align:center;margin-top:24px}
noscript .msg{margin:16px}
</style>
</head>
<body>
<main>
  <header>
    <h1>HyperFrames Render</h1>
    <p>Render video komposisi lewat GitHub Actions, hasilnya disimpan di R2.</p>
  </header>

  <noscript><div class="msg err">Halaman ini membutuhkan JavaScript. API tetap bisa dipakai lewat curl (lihat <code>/api</code>).</div></noscript>

  <section class="card" aria-labelledby="t-form">
    <h2 id="t-form">Render baru</h2>
    <form id="form" autocomplete="off" novalidate>
      <div class="field">
        <label for="apikey">API key</label>
        <div class="row">
          <input id="apikey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required>
          <button type="button" id="toggleKey" aria-controls="apikey" aria-pressed="false">Tampilkan</button>
        </div>
      </div>
      <label class="check"><input type="checkbox" id="remember"> Ingat API key hanya di tab ini (hilang saat tab ditutup)</label>

      <div class="grid">
        <div class="field">
          <label for="composition">Komposisi</label>
          <input id="composition" type="text" value="contoh" maxlength="64" autocapitalize="off" spellcheck="false" required>
          <p class="hint">Nama folder di <code>cloudflare-free/compositions/</code></p>
        </div>
        <div class="field">
          <label for="quality">Kualitas</label>
          <select id="quality">
            <option value="draft">draft (tercepat)</option>
            <option value="standard" selected>standard</option>
            <option value="high">high (paling lama)</option>
          </select>
        </div>
        <div class="field full">
          <label for="rid">ID output (opsional)</label>
          <input id="rid" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="kosongkan untuk UUID acak">
          <p class="hint">Huruf, angka, <code>_</code> dan <code>-</code>, maks 64. Status &amp; video bersifat publik, jadi ID acak lebih aman.</p>
        </div>
      </div>

      <button class="primary" type="submit" id="submit">Mulai render</button>
      <div id="formMsg" class="msg" role="alert" hidden></div>
    </form>
  </section>

  <section class="card" id="jobCard" aria-labelledby="t-job" hidden>
    <h2 id="t-job">Status</h2>
    <div class="top">
      <span id="badge" class="badge" role="status" aria-live="polite"></span>
      <span id="elapsed" class="h-meta"></span>
    </div>
    <dl class="kv">
      <dt>ID</dt><dd><code id="jId"></code></dd>
      <dt>Komposisi</dt><dd id="jComp"></dd>
      <dt>Kualitas</dt><dd id="jQual"></dd>
      <dt>Ukuran</dt><dd id="jSize">-</dd>
    </dl>
    <div id="jNote" class="msg" hidden></div>
    <video id="video" controls preload="metadata" playsinline hidden></video>
    <div class="actions">
      <a id="dl" class="btn" href="#" download hidden>Unduh MP4</a>
      <button type="button" id="copyVideo" hidden>Salin tautan video</button>
      <button type="button" id="copyPage" hidden>Salin tautan halaman</button>
      <button type="button" id="stop" class="danger" hidden>Berhenti memantau</button>
      <button type="button" id="recheck" hidden>Cek lagi</button>
    </div>
  </section>

  <section class="card" aria-labelledby="t-hist">
    <div class="top">
      <h2 id="t-hist" style="margin:0">Riwayat di perangkat ini</h2>
      <button type="button" id="clearHist" class="small danger" hidden>Hapus riwayat</button>
    </div>
    <ul id="hist" class="hist"></ul>
    <p id="histEmpty" class="empty">Belum ada render.</p>
    <details style="margin-top:14px">
      <summary>Pantau ID yang sudah ada</summary>
      <div class="row" style="margin-top:10px">
        <input id="manualId" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="ID render">
        <button type="button" id="manualGo">Pantau</button>
      </div>
      <p>Tidak butuh API key. Cukup untuk memutar atau mengunduh hasil yang sudah selesai.</p>
    </details>
  </section>

  <footer>
    Status gagal tidak bisa dideteksi dari sini. Bila render tak kunjung selesai, cek log workflow <em>Render video</em> di tab Actions GitHub.
  </footer>
</main>

<script nonce="__NONCE__">
(function () {
  'use strict';

  var ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  var KEY_STORE = 'hf_api_key';
  var HIST_STORE = 'hf_history';
  var HIST_MAX = 12;
  var MAX_WAIT_MS = 35 * 60 * 1000; // workflow dibatasi 30 menit + antrean
  var STATUS_TIMEOUT_MS = 15000;
  var POST_TIMEOUT_MS = 25000;

  function $(id) { return document.getElementById(id); }
  var el = {
    form: $('form'), apikey: $('apikey'), toggleKey: $('toggleKey'), remember: $('remember'),
    composition: $('composition'), quality: $('quality'), rid: $('rid'),
    submit: $('submit'), formMsg: $('formMsg'),
    jobCard: $('jobCard'), badge: $('badge'), elapsed: $('elapsed'),
    jId: $('jId'), jComp: $('jComp'), jQual: $('jQual'), jSize: $('jSize'), jNote: $('jNote'),
    video: $('video'), dl: $('dl'), copyVideo: $('copyVideo'), copyPage: $('copyPage'),
    stop: $('stop'), recheck: $('recheck'),
    hist: $('hist'), histEmpty: $('histEmpty'), clearHist: $('clearHist'),
    manualId: $('manualId'), manualGo: $('manualGo')
  };

  /* ---------- penyimpanan (semua dibungkus try/catch) ---------- */
  function store(kind) {
    try { return kind === 'session' ? window.sessionStorage : window.localStorage; }
    catch (e) { return null; }
  }
  function sGet(kind, key) {
    var s = store(kind);
    if (!s) return null;
    try { return s.getItem(key); } catch (e) { return null; }
  }
  function sSet(kind, key, val) {
    var s = store(kind);
    if (!s) return;
    try { s.setItem(key, val); } catch (e) { /* abaikan */ }
  }
  function sDel(kind, key) {
    var s = store(kind);
    if (!s) return;
    try { s.removeItem(key); } catch (e) { /* abaikan */ }
  }

  /* ---------- riwayat ---------- */
  var QUALS = { draft: 1, standard: 1, high: 1 };
  function loadHist() {
    var raw = sGet('local', HIST_STORE);
    if (!raw) return [];
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length && out.length < HIST_MAX; i++) {
      var it = arr[i];
      if (!it || typeof it !== 'object') continue;
      if (typeof it.id !== 'string' || !ID_RE.test(it.id)) continue;
      out.push({
        id: it.id,
        composition: (typeof it.composition === 'string' && ID_RE.test(it.composition)) ? it.composition : '-',
        quality: QUALS[it.quality] ? it.quality : '-',
        ts: (typeof it.ts === 'number' && isFinite(it.ts)) ? it.ts : Date.now(),
        status: (it.status === 'done' || it.status === 'timeout') ? it.status : 'pending'
      });
    }
    return out;
  }
  function saveHist(list) { sSet('local', HIST_STORE, JSON.stringify(list.slice(0, HIST_MAX))); }
  function upsertHist(item) {
    var list = loadHist().filter(function (x) { return x.id !== item.id; });
    list.unshift(item);
    saveHist(list);
  }
  function setHistStatus(id, status) {
    var list = loadHist();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) list[i].status = status;
    saveHist(list);
  }
  function findHist(id) {
    var list = loadHist();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function removeHist(id) {
    saveHist(loadHist().filter(function (x) { return x.id !== id; }));
  }

  var STATUS_LABEL = { pending: 'diproses', done: 'selesai', timeout: 'tidak selesai' };
  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return new Date(ts).toISOString(); }
  }
  function fmtBytes(n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0) return '-';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? String(n) : n.toFixed(2)) + ' ' + u[i];
  }
  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function renderHist() {
    var list = loadHist();
    el.hist.textContent = '';
    el.histEmpty.hidden = list.length > 0;
    el.clearHist.hidden = list.length === 0;
    list.forEach(function (it) {
      var li = document.createElement('li');

      var info = document.createElement('div');
      info.className = 'h-info';
      var code = document.createElement('code');
      code.textContent = it.id;
      var meta = document.createElement('span');
      meta.className = 'h-meta';
      meta.textContent = it.composition + ' · ' + it.quality + ' · ' + fmtTime(it.ts) + ' · ' + STATUS_LABEL[it.status];
      info.appendChild(code);
      info.appendChild(meta);

      var btns = document.createElement('div');
      btns.className = 'h-btns';
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'small';
      open.textContent = it.status === 'done' ? 'Putar' : 'Pantau';
      open.addEventListener('click', function () { track(it.id, it.composition, it.quality, it.ts); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'small danger';
      del.textContent = 'Hapus';
      del.addEventListener('click', function () { removeHist(it.id); renderHist(); });
      btns.appendChild(open);
      btns.appendChild(del);

      li.appendChild(info);
      li.appendChild(btns);
      el.hist.appendChild(li);
    });
  }

  /* ---------- pesan form ---------- */
  function formMsg(text, kind) {
    if (!text) { el.formMsg.hidden = true; el.formMsg.textContent = ''; return; }
    el.formMsg.className = 'msg' + (kind ? ' ' + kind : '');
    el.formMsg.textContent = text;
    el.formMsg.hidden = false;
  }

  function describeError(status, data) {
    var code = data && typeof data.error === 'string' ? data.error : '';
    switch (code) {
      case 'unauthorized': return 'API key salah.';
      case 'server_not_configured': return 'Server belum dikonfigurasi (secret API_KEY / GITHUB_TOKEN atau var GITHUB_REPO belum diset).';
      case 'id_already_exists': return 'ID sudah dipakai. Kosongkan ID untuk UUID acak atau pilih ID lain.';
      case 'invalid_id': return 'ID tidak valid (huruf, angka, _ dan - saja, maks 64).';
      case 'invalid_composition': return 'Nama komposisi tidak valid.';
      case 'invalid_quality': return 'Kualitas tidak valid.';
      case 'invalid_json': return 'Permintaan tidak valid.';
      case 'body_too_large': return 'Permintaan terlalu besar.';
      case 'dispatch_failed': {
        var g = data && data.github_status;
        var base = 'Gagal memicu GitHub Actions' + (g ? ' (GitHub ' + g + ')' : '') + '.';
        if (g === 404) return base + ' Token salah atau tidak punya akses ke repo.';
        if (g === 403) return base + ' Izin token Contents belum Read and write.';
        if (g === 401) return base + ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
        return base;
      }
      default: return 'Gagal (HTTP ' + status + ').';
    }
  }

  /* ---------- pelacakan job ---------- */
  var current = null; // { id, comp, qual, start, fails, timer, tick }

  function stopTimers(job) {
    if (!job) return;
    if (job.timer) { clearTimeout(job.timer); job.timer = null; }
    if (job.tick) { clearInterval(job.tick); job.tick = null; }
  }

  function setBadge(kind, text) {
    el.badge.className = 'badge' + (kind ? ' ' + kind : '');
    el.badge.textContent = '';
    if (kind === 'run') {
      var sp = document.createElement('span');
      sp.className = 'spin';
      sp.setAttribute('aria-hidden', 'true');
      el.badge.appendChild(sp);
    }
    el.badge.appendChild(document.createTextNode(text));
  }
  function setNote(text, kind) {
    if (!text) { el.jNote.hidden = true; el.jNote.textContent = ''; return; }
    el.jNote.className = 'msg' + (kind ? ' ' + kind : '');
    el.jNote.textContent = text;
    el.jNote.hidden = false;
  }
  function setButtons(o) {
    el.stop.hidden = !o.stop;
    el.recheck.hidden = !o.recheck;
    el.dl.hidden = !o.done;
    el.copyVideo.hidden = !o.done;
    el.copyPage.hidden = !o.done;
  }
  function resetVideo() {
    try { el.video.pause(); } catch (e) { /* abaikan */ }
    el.video.removeAttribute('src');
    try { el.video.load(); } catch (e) { /* abaikan */ }
    el.video.hidden = true;
  }

  function track(id, comp, qual, startedAt) {
    if (!ID_RE.test(id)) return;
    if (current) { stopTimers(current); }
    resetVideo();
    var job = {
      id: id, comp: comp || '-', qual: qual || '-',
      start: (typeof startedAt === 'number' && isFinite(startedAt) && startedAt <= Date.now()) ? startedAt : Date.now(),
      fails: 0, timer: null, tick: null
    };
    current = job;

    el.jId.textContent = id;
    el.jComp.textContent = job.comp;
    el.jQual.textContent = job.qual;
    el.jSize.textContent = '-';
    el.elapsed.textContent = '';
    setNote('');
    setButtons({ stop: true });
    setBadge('run', 'Diproses');
    el.jobCard.hidden = false;
    try { el.jobCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* abaikan */ }

    job.tick = setInterval(function () {
      if (current !== job) return;
      var ms = Date.now() - job.start;
      el.elapsed.textContent = 'Berjalan ' + fmtDur(ms);
      if (ms > 10 * 60 * 1000 && !job.fails) {
        setNote('Sudah lebih dari 10 menit. Render panjang memang lama; bila terlalu lama, cek log workflow di tab Actions GitHub.', 'warn');
      }
    }, 1000);
    el.elapsed.textContent = 'Berjalan ' + fmtDur(Date.now() - job.start);

    poll(job);
  }

  function delayFor(job) {
    var ms = Date.now() - job.start;
    if (ms < 2 * 60 * 1000) return 4000;
    if (ms < 10 * 60 * 1000) return 8000;
    return 15000;
  }

  async function poll(job) {
    if (current !== job) return;
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, STATUS_TIMEOUT_MS);
    var res = null;
    try {
      res = await fetch('/status/' + job.id, { cache: 'no-store', signal: ctrl.signal });
    } catch (e) {
      res = null;
    }
    clearTimeout(to);
    if (current !== job) return;

    if (res && res.status === 200) {
      var d = {};
      try { d = await res.json(); } catch (e) { d = {}; }
      if (current !== job) return;
      finish(job, d);
      return;
    }

    if (res && res.status === 404) {
      job.fails = 0;
    } else {
      job.fails++;
      setNote('Gagal menghubungi server (' + (res ? 'HTTP ' + res.status : 'jaringan') + '). Mencoba lagi…', 'warn');
    }

    if (Date.now() - job.start > MAX_WAIT_MS) { timeout(job); return; }
    job.timer = setTimeout(function () { poll(job); }, delayFor(job));
  }

  function finish(job, d) {
    stopTimers(job);
    setBadge('done', 'Selesai');
    el.elapsed.textContent = '';
    setNote('');
    el.jSize.textContent = fmtBytes(d && d.size);
    var path = '/video/' + job.id;
    el.video.src = path;
    el.video.hidden = false;
    try { el.video.load(); } catch (e) { /* abaikan */ }
    el.dl.href = path;
    el.dl.setAttribute('download', job.id + '.mp4');
    setButtons({ done: true });
    upsertHist({ id: job.id, composition: job.comp, quality: job.qual, ts: job.start, status: 'done' });
    renderHist();
  }

  function timeout(job) {
    stopTimers(job);
    setBadge('bad', 'Belum selesai');
    el.elapsed.textContent = '';
    setNote('Belum selesai setelah 35 menit. Kemungkinan render gagal: cek log workflow "Render video" di tab Actions GitHub.', 'err');
    setButtons({ recheck: true });
    setHistStatus(job.id, 'timeout');
    renderHist();
  }

  el.stop.addEventListener('click', function () {
    if (!current) return;
    var job = current;
    stopTimers(job);
    setBadge('', 'Pemantauan dihentikan');
    el.elapsed.textContent = '';
    setNote('Render di GitHub tetap berjalan. Klik "Cek lagi" atau buka dari riwayat untuk memantau kembali.');
    setButtons({ recheck: true });
  });

  el.recheck.addEventListener('click', function () {
    if (!current) return;
    var j = current;
    track(j.id, j.comp, j.qual, Date.now());
  });

  /* ---------- salin tautan ---------- */
  async function copyText(text, btn) {
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
    }
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    btn.textContent = ok ? 'Tersalin' : 'Gagal menyalin';
    setTimeout(function () { btn.textContent = old; }, 1500);
  }
  el.copyVideo.addEventListener('click', function () {
    if (current) copyText(location.origin + '/video/' + current.id, el.copyVideo);
  });
  el.copyPage.addEventListener('click', function () {
    if (current) copyText(location.origin + '/?id=' + current.id, el.copyPage);
  });

  /* ---------- form ---------- */
  el.toggleKey.addEventListener('click', function () {
    var show = el.apikey.type === 'password';
    el.apikey.type = show ? 'text' : 'password';
    el.toggleKey.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    el.toggleKey.setAttribute('aria-pressed', show ? 'true' : 'false');
  });

  el.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    formMsg('');

    var key = el.apikey.value.trim();
    var comp = el.composition.value.trim() || 'contoh';
    var qual = el.quality.value;
    var rid = el.rid.value.trim();

    if (!key) { formMsg('API key wajib diisi.', 'err'); el.apikey.focus(); return; }
    if (!ID_RE.test(comp)) { formMsg('Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); el.composition.focus(); return; }
    if (!QUALS[qual]) { formMsg('Kualitas tidak valid.', 'err'); return; }
    if (rid && !ID_RE.test(rid)) { formMsg('ID tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); el.rid.focus(); return; }

    if (el.remember.checked) sSet('session', KEY_STORE, key); else sDel('session', KEY_STORE);

    var payload = { composition: comp, quality: qual };
    if (rid) payload.id = rid;

    el.submit.disabled = true;
    el.submit.textContent = 'Mengirim…';
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, POST_TIMEOUT_MS);
    try {
      var res = await fetch('/render', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: ctrl.signal
      });
      var data = {};
      try { data = await res.json(); } catch (e) { data = {}; }

      if (res.status === 202 && data && typeof data.id === 'string' && ID_RE.test(data.id)) {
        var started = Date.now();
        upsertHist({ id: data.id, composition: comp, quality: qual, ts: started, status: 'pending' });
        renderHist();
        el.rid.value = '';
        track(data.id, comp, qual, started);
      } else {
        formMsg(describeError(res.status, data), 'err');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') formMsg('Server tidak merespons (timeout). Coba lagi.', 'err');
      else if (e && e.name === 'TypeError' && /header|value/i.test(String(e.message))) formMsg('API key mengandung karakter yang tidak valid.', 'err');
      else formMsg('Tidak bisa menghubungi server. Periksa koneksi.', 'err');
    } finally {
      clearTimeout(to);
      el.submit.disabled = false;
      el.submit.textContent = 'Mulai render';
    }
  });

  /* ---------- riwayat & pantau manual ---------- */
  el.clearHist.addEventListener('click', function () {
    if (window.confirm('Hapus semua riwayat di perangkat ini? (Video di server tidak ikut terhapus.)')) {
      sDel('local', HIST_STORE);
      renderHist();
    }
  });
  function manualTrack() {
    var id = el.manualId.value.trim();
    if (!ID_RE.test(id)) { el.manualId.focus(); el.manualId.setCustomValidity('ID tidak valid'); el.manualId.reportValidity(); el.manualId.setCustomValidity(''); return; }
    var h = findHist(id);
    track(id, h ? h.composition : '-', h ? h.quality : '-', h ? h.ts : Date.now());
    el.manualId.value = '';
  }
  el.manualGo.addEventListener('click', manualTrack);
  el.manualId.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); manualTrack(); } });

  /* ---------- init ---------- */
  var savedKey = sGet('session', KEY_STORE);
  if (savedKey) { el.apikey.value = savedKey; el.remember.checked = true; }
  renderHist();

  try {
    var qid = new URLSearchParams(location.search).get('id');
    if (qid && ID_RE.test(qid)) {
      var h0 = findHist(qid);
      track(qid, h0 ? h0.composition : '-', h0 ? h0.quality : '-', h0 ? h0.ts : Date.now());
    }
  } catch (e) { /* abaikan */ }
})();
</script>
</body>
</html>
`;
