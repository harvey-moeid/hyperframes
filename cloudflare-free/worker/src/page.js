/**
 * Halaman web HyperFrames Render (GET /) — modul terpisah dari logika API.
 *
 * KEPUTUSAN DESAIN (ringkas; detail di cloudflare-free/docs/UI.md):
 *  - Mobile-first: layout 1 kolom, target sentuh >= 44px, font input 16px (iOS tidak zoom
 *    saat fokus), safe-area (notch / home indicator), tinggi layar pakai dvh.
 *  - Tema gelap premium (aurora gradient + kartu kaca) dengan fallback tema terang lewat
 *    prefers-color-scheme. Tanpa font/gambar/CDN eksternal: system font + SVG inline.
 *  - CSP ketat tetap dipertahankan: script & style hanya lewat nonce acak per respons,
 *    TIDAK ada atribut style inline, data server masuk DOM lewat textContent saja.
 *  - Semua id elemen & perilaku lama dipertahankan (render, aset, polling, riwayat);
 *    yang baru murni presentasi: segmented control, progress bar, penghitung ukuran HTML.
 *
 * ATURAN ISI TEMPLAT (String.raw): JANGAN pakai backtick atau ${ di dalam PAGE_HTML
 * maupun COMPOSITION_TEMPLATE, dan jangan menulis teks __NONCE__ / __TEMPLATE_JSON__ selain
 * sebagai penanda yang memang diganti oleh htmlPage().
 */

function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function htmlPage() {
  const nonce = makeNonce();
  const body = PAGE_HTML.split("__NONCE__")
    .join(nonce)
    // Templat disisipkan sebagai literal string JS; dilakukan SETELAH nonce diganti.
    .split("__TEMPLATE_JSON__")
    .join(TEMPLATE_JSON);
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#060912" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f3f5fb" media="(prefers-color-scheme: light)">
<meta name="robots" content="noindex">
<title>HyperFrames Render</title>
<style nonce="__NONCE__">
/* ============ Token desain ============ */
:root{
  color-scheme:dark;
  --bg:#060912;
  --surface:rgba(17,23,40,.74);
  --surface-solid:#121a2d;
  --field:rgba(7,11,22,.70);
  --line:rgba(148,163,184,.16);
  --line-strong:rgba(148,163,184,.34);
  --text:#eef2fb;
  --mut:#98a4bd;
  --faint:#6d7a96;
  --acc:#7a93ff;
  --acc-ring:rgba(122,147,255,.28);
  --grad:linear-gradient(135deg,#6d8bff 0%,#8b5cf6 52%,#22d3ee 135%);
  --grad-text:linear-gradient(120deg,#ffffff 10%,#b9c6ff 55%,#7ee7f7 100%);
  --on-acc:#ffffff;
  --ok:#34d399;--warn:#fbbf24;--err:#fb7185;
  --glow1:rgba(109,139,255,.22);--glow2:rgba(139,92,246,.16);--glow3:rgba(34,211,238,.10);
  --shadow:0 1px 0 rgba(255,255,255,.05) inset,0 24px 48px -24px rgba(0,0,0,.75);
  --btn-shadow:0 10px 28px -10px rgba(109,139,255,.65);
  --r:18px;--r-sm:12px;
  --font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: light){
  :root{
    color-scheme:light;
    --bg:#f3f5fb;
    --surface:rgba(255,255,255,.82);
    --surface-solid:#ffffff;
    --field:rgba(240,243,250,.85);
    --line:rgba(30,41,80,.12);
    --line-strong:rgba(30,41,80,.30);
    --text:#131a2e;
    --mut:#55627f;
    --faint:#7d89a5;
    --acc:#3b5bdb;
    --acc-ring:rgba(59,91,219,.22);
    --grad:linear-gradient(135deg,#3b5bdb 0%,#6d4de0 55%,#0891b2 140%);
    --grad-text:linear-gradient(120deg,#131a2e 10%,#3b5bdb 60%,#0891b2 100%);
    --ok:#0f8a5f;--warn:#a86a0a;--err:#cf3a52;
    --glow1:rgba(59,91,219,.16);--glow2:rgba(109,77,224,.10);--glow3:rgba(8,145,178,.08);
    --shadow:0 1px 0 rgba(255,255,255,.9) inset,0 20px 40px -26px rgba(30,41,80,.35);
    --btn-shadow:0 10px 26px -12px rgba(59,91,219,.6);
  }
}

/* ============ Dasar ============ */
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;min-height:100vh;min-height:100dvh;
  background:var(--bg);color:var(--text);
  font:15px/1.55 var(--font);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
}
/* Aurora latar: satu lapisan fixed, tidak ikut scroll (ringan di HP). */
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(58rem 34rem at 10% -8%,var(--glow1),transparent 62%),
    radial-gradient(44rem 28rem at 100% 2%,var(--glow2),transparent 58%),
    radial-gradient(40rem 26rem at 50% 112%,var(--glow3),transparent 62%);
}
::selection{background:var(--acc-ring)}

/* ============ Top bar ============ */
.topbar{
  position:sticky;top:0;z-index:20;
  padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));
  background:var(--bg);
  background:color-mix(in srgb,var(--bg) 72%,transparent);
  -webkit-backdrop-filter:saturate(160%) blur(14px);backdrop-filter:saturate(160%) blur(14px);
  border-bottom:1px solid var(--line);
}
.topbar-in{max-width:820px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.brand svg{width:32px;height:32px;flex:none;display:block}
.brand-name{font-weight:700;letter-spacing:.2px;font-size:16px;white-space:nowrap}
.brand-name span{color:var(--mut);font-weight:500}
.chip-link{
  display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:var(--mut);
  font-size:13px;font-weight:600;padding:7px 12px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);min-height:34px;
  transition:color .2s,border-color .2s;
}
.chip-link:hover{color:var(--text);border-color:var(--line-strong)}

/* ============ Layout ============ */
main{
  max-width:820px;margin:0 auto;
  padding:28px max(16px,env(safe-area-inset-right,0px)) calc(56px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));
}
.hero{margin:0 0 26px}
.eyebrow{
  display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--mut);padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);
}
.eyebrow i{
  width:7px;height:7px;border-radius:50%;background:var(--ok);
  box-shadow:0 0 0 4px var(--line);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 22%,transparent);
}
h1{
  margin:16px 0 10px;font-size:clamp(30px,7.2vw,46px);line-height:1.08;letter-spacing:-.025em;font-weight:800;
  color:var(--text);
  background:var(--grad-text);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}
.lead{margin:0;color:var(--mut);font-size:16px;max-width:56ch}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
.pills li{
  font-size:12.5px;font-weight:600;color:var(--mut);padding:6px 11px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);
}

/* ============ Kartu ============ */
.card{
  position:relative;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);
  padding:22px;margin:0 0 18px;box-shadow:var(--shadow);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  animation:rise .55s cubic-bezier(.2,.7,.2,1) both;
}
.card:nth-of-type(2){animation-delay:.06s}
.card:nth-of-type(3){animation-delay:.12s}
.card:nth-of-type(4){animation-delay:.18s}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
#jobCard{scroll-margin-top:72px}
.sec-h{display:flex;align-items:center;gap:12px;margin:0 0 18px}
.sec-h h2{margin:0;font-size:17px;letter-spacing:-.01em;font-weight:700}
.sec-h p{margin:2px 0 0;font-size:13px;color:var(--mut)}
.num{
  flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;
  font-size:13px;font-weight:800;color:var(--on-acc);background:var(--grad);box-shadow:var(--btn-shadow);
}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.top .sec-h{margin:0}
.mt14{margin-top:14px}
.mt10{margin-top:10px}

/* ============ Form ============ */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.field{display:flex;flex-direction:column;gap:7px;margin:0 0 16px;min-width:0}
.field.full{grid-column:1/-1}
.lbl-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
label,.lbl{font-size:13px;font-weight:600;color:var(--mut)}
input,select,textarea,button{font:inherit;color:inherit}
input[type=text],input[type=password],textarea{
  width:100%;padding:12px 14px;border-radius:var(--r-sm);border:1px solid var(--line);
  background:var(--field);color:var(--text);min-height:46px;
  transition:border-color .2s,box-shadow .2s,background .2s;
}
input[type=file]{
  width:100%;padding:10px;border-radius:var(--r-sm);border:1px dashed var(--line-strong);
  background:var(--field);color:var(--mut);min-height:52px;font-size:14px;
}
input[type=file]::file-selector-button{
  margin-right:12px;padding:8px 14px;border-radius:9px;border:1px solid var(--line-strong);
  background:var(--surface-solid);color:var(--text);font:inherit;font-weight:600;cursor:pointer;
}
input::placeholder,textarea::placeholder{color:var(--faint)}
input[type=text]:hover,input[type=password]:hover,textarea:hover{border-color:var(--line-strong)}
input:focus-visible,textarea:focus-visible{outline:none;border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-ring)}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
textarea{
  font:13px/1.55 var(--mono);min-height:240px;resize:vertical;white-space:pre;overflow:auto;tab-size:2;
}
.row{display:flex;gap:8px}
.row>input{flex:1;min-width:0}
.hint{font-size:12.5px;line-height:1.5;color:var(--faint);margin:0}
.hint code,.lead code,.sec-h code{color:var(--mut)}
.check{
  display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--mut);margin:0 0 18px;cursor:pointer;line-height:1.45;
}
.check input{
  appearance:none;-webkit-appearance:none;flex:none;width:20px;height:20px;margin:1px 0 0;border-radius:6px;
  border:1px solid var(--line-strong);background:var(--field);display:grid;place-content:center;cursor:pointer;
  transition:background .15s,border-color .15s;
}
.check input::after{
  content:"";width:10px;height:6px;border-left:2px solid var(--on-acc);border-bottom:2px solid var(--on-acc);
  transform:rotate(-45deg) scale(0);margin-top:-2px;transition:transform .12s;
}
.check input:checked{background:var(--acc);border-color:var(--acc)}
.check input:checked::after{transform:rotate(-45deg) scale(1)}
.check input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.count{font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}
.count.over{color:var(--err);font-weight:700}

/* Segmented control (menggantikan <select>; select asli tetap ada, tersembunyi, sebagai sumber nilai) */
.seg{
  display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;
  border-radius:14px;border:1px solid var(--line);background:var(--field);
}
.seg button{
  border:1px solid transparent;background:transparent;color:var(--mut);cursor:pointer;
  border-radius:10px;min-height:42px;padding:8px 10px;font-size:14px;font-weight:600;line-height:1.2;
  transition:background .18s,color .18s,box-shadow .18s;
}
.seg button:hover{color:var(--text)}
.seg button[aria-pressed=true]{
  background:var(--surface-solid);color:var(--text);border-color:var(--line);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 6px 14px -8px rgba(0,0,0,.55);
}

/* ============ Tombol ============ */
button{
  cursor:pointer;border-radius:var(--r-sm);border:1px solid var(--line-strong);
  background:var(--surface-solid);padding:10px 16px;min-height:44px;font-weight:600;font-size:14px;
  transition:border-color .2s,transform .12s,filter .2s,background .2s,color .2s;
}
button:hover:not(:disabled){border-color:var(--acc)}
button:active:not(:disabled){transform:scale(.985)}
button:disabled{opacity:.55;cursor:not-allowed}
button.primary{
  width:100%;min-height:52px;font-size:16px;border:0;color:var(--on-acc);background:var(--grad);
  box-shadow:var(--btn-shadow);letter-spacing:.2px;
}
button.primary:hover:not(:disabled){filter:brightness(1.08) saturate(1.05)}
button.small{min-height:36px;padding:6px 12px;font-size:13px}
button.danger:hover:not(:disabled){border-color:var(--err);color:var(--err)}
a.btn{
  display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;font-weight:600;font-size:14px;
  border:1px solid var(--line-strong);background:var(--surface-solid);border-radius:var(--r-sm);padding:10px 16px;min-height:44px;
  transition:border-color .2s;
}
a.btn:hover{border-color:var(--acc)}
a.btn.solid{border:0;background:var(--grad);color:var(--on-acc);box-shadow:var(--btn-shadow)}

/* ============ Pesan & status ============ */
.msg{
  margin:14px 0 0;padding:11px 14px;border-radius:var(--r-sm);font-size:14px;line-height:1.5;
  border:1px solid var(--line);border-left-width:3px;background:var(--field);
}
.msg.err{border-color:var(--err);border-color:color-mix(in srgb,var(--err) 45%,transparent);border-left-color:var(--err);color:var(--err)}
.msg.ok{border-color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);border-left-color:var(--ok);color:var(--ok)}
.msg.warn{border-color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);border-left-color:var(--warn);color:var(--warn)}
.badge{
  display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;
  font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--field);
}
.badge.run{color:var(--warn);border-color:var(--warn);border-color:color-mix(in srgb,var(--warn) 50%,transparent)}
.badge.done{color:var(--ok);border-color:var(--ok);border-color:color-mix(in srgb,var(--ok) 50%,transparent)}
.badge.bad{color:var(--err);border-color:var(--err);border-color:color-mix(in srgb,var(--err) 50%,transparent)}
.spin{width:11px;height:11px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.prog{height:4px;border-radius:99px;background:var(--line);overflow:hidden;position:relative;margin:0 0 16px}
.prog span{position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:inherit;background:var(--grad);animation:slide 1.5s ease-in-out infinite}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(270%)}}
.h-meta{font-size:12.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
.kv>div{padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--field);min-width:0}
.kv dt{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin:0 0 3px}
.kv dd{margin:0;font-size:14px;font-weight:600;word-break:break-all}
code{font:13px var(--mono)}
video{
  width:100%;max-height:70vh;max-height:70dvh;aspect-ratio:16/9;object-fit:contain;background:#000;
  border-radius:14px;border:1px solid var(--line);display:block;margin:0 0 14px;
}
.actions{display:flex;flex-wrap:wrap;gap:8px}

/* ============ Riwayat ============ */
ul.hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
ul.hist li{
  display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--field);
  transition:border-color .2s;
}
ul.hist li:hover{border-color:var(--line-strong)}
.dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--faint)}
li.st-done .dot{background:var(--ok);box-shadow:0 0 0 4px var(--line);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 20%,transparent)}
li.st-pending .dot{background:var(--warn);box-shadow:0 0 0 4px var(--line);box-shadow:0 0 0 4px color-mix(in srgb,var(--warn) 20%,transparent)}
li.st-failed .dot,li.st-timeout .dot{background:var(--err);box-shadow:0 0 0 4px var(--line);box-shadow:0 0 0 4px color-mix(in srgb,var(--err) 20%,transparent)}
.h-info{min-width:0;flex:1 1 200px}
.h-info code{display:block;word-break:break-all;font-weight:600}
.h-btns{display:flex;gap:6px}
.empty{color:var(--mut);margin:0;font-size:14px;text-align:center;padding:14px 0}
details{border-top:1px solid var(--line);margin-top:16px;padding-top:14px}
details summary{cursor:pointer;color:var(--mut);font-size:14px;font-weight:600;min-height:32px;display:flex;align-items:center}
details p{font-size:13px;color:var(--faint);margin:10px 0 0}
footer{color:var(--faint);font-size:12.5px;text-align:center;margin-top:28px;line-height:1.6}
noscript .msg{margin:16px}

/* ============ Mobile ============ */
@media (max-width:640px){
  body{font-size:15px}
  main{padding-top:20px}
  /* Tanpa blur di HP: backdrop-filter pada banyak kartu membuat scroll berat di perangkat kelas bawah. */
  .card{
    padding:18px 16px;border-radius:16px;background:var(--surface-solid);
    -webkit-backdrop-filter:none;backdrop-filter:none;
  }
  .grid{grid-template-columns:1fr}
  /* 16px juga untuk textarea agar iOS tidak zoom saat fokus. */
  input[type=text],input[type=password],textarea{font-size:16px}
  textarea{min-height:200px}
  .kv{grid-template-columns:1fr 1fr}
  .actions>*{flex:1 1 calc(50% - 8px)}
  .actions>a.btn.solid{flex-basis:100%}
  .h-btns{width:100%}
  .h-btns button{flex:1}
  .brand-name span{display:none}
  video{border-radius:12px}
}
@media (max-width:380px){
  .seg button{font-size:13px;padding:8px 6px}
  .eyebrow{font-size:11px;letter-spacing:.05em}
}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
@media (prefers-contrast: more){
  :root{--line:rgba(148,163,184,.45);--line-strong:rgba(148,163,184,.7)}
}
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <div class="brand">
      <svg viewBox="0 0 32 32" role="img" aria-label="HyperFrames">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#6d8bff"/>
            <stop offset=".55" stop-color="#8b5cf6"/>
            <stop offset="1" stop-color="#22d3ee"/>
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)"/>
        <rect x="7" y="8" width="18" height="16" rx="3" fill="none" stroke="#fff" stroke-width="1.8" opacity=".95"/>
        <path d="M14 12.2v7.6l6-3.8z" fill="#fff"/>
      </svg>
      <span class="brand-name">HyperFrames <span>Render</span></span>
    </div>
    <a class="chip-link" href="/api">API</a>
  </div>
</header>

<main>
  <div class="hero">
    <span class="eyebrow"><i aria-hidden="true"></i>Cloudflare Free &middot; GitHub Actions &middot; R2</span>
    <h1>Render video, langsung dari browser.</h1>
    <p class="lead">Kirim komposisi HTML, dirender otomatis lewat GitHub Actions, hasil MP4 siap diputar dan diunduh dari R2.</p>
    <ul class="pills" aria-label="Keunggulan">
      <li>100% paket gratis</li>
      <li>3 level kualitas</li>
      <li>Pantau status real-time</li>
    </ul>
  </div>

  <noscript><div class="msg err">Halaman ini membutuhkan JavaScript. API tetap bisa dipakai lewat curl (lihat <code>/api</code>).</div></noscript>

  <section class="card" aria-labelledby="t-form">
    <div class="sec-h">
      <span class="num" aria-hidden="true">1</span>
      <div><h2 id="t-form">Render baru</h2><p>Pilih komposisi, atur kualitas, lalu mulai.</p></div>
    </div>
    <form id="form" autocomplete="off" novalidate>
      <div class="field">
        <label for="apikey">API key</label>
        <div class="row">
          <input id="apikey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required>
          <button type="button" id="toggleKey" aria-controls="apikey" aria-pressed="false">Tampilkan</button>
        </div>
      </div>
      <label class="check"><input type="checkbox" id="remember"><span>Ingat API key hanya di tab ini (hilang saat tab ditutup)</span></label>

      <div class="field">
        <span class="lbl" id="lbl-mode">Sumber komposisi</span>
        <div class="seg" data-for="mode" role="group" aria-labelledby="lbl-mode">
          <button type="button" data-value="existing" aria-pressed="true">Sudah ada di repo</button>
          <button type="button" data-value="new" aria-pressed="false">Tulis baru</button>
        </div>
        <select id="mode" class="sr-only" tabindex="-1" aria-hidden="true">
          <option value="existing" selected>Komposisi yang sudah ada di repo</option>
          <option value="new">Tulis komposisi baru (di-commit ke repo)</option>
        </select>
      </div>

      <div id="newBox" hidden>
        <div class="field">
          <label for="newName">Nama komposisi (opsional)</label>
          <input id="newName" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="kosongkan untuk web-ID otomatis">
          <p class="hint">Disimpan di <code>cloudflare-free/compositions/&lt;nama&gt;/index.html</code>. Bila nama sudah ada, permintaan ditolak dan file lama tidak ditimpa.</p>
        </div>
        <div class="field">
          <label for="htmlFile">Unggah file komposisi (.html)</label>
          <input id="htmlFile" type="file" accept=".html,.htm,text/html">
          <p class="hint">Isi file dimuat ke kotak di bawah (tidak langsung dikirim), jadi bisa dicek dan diedit dulu. Maks 256 KB. Bila nama komposisi kosong, terisi otomatis dari nama file.</p>
          <div id="htmlFileMsg" class="msg" role="alert" hidden></div>
        </div>
        <div class="field">
          <div class="lbl-row">
            <label for="html">Isi komposisi (index.html)</label>
            <button type="button" id="tplBtn" class="small">Isi dari contoh</button>
          </div>
          <textarea id="html" spellcheck="false" autocapitalize="off" wrap="off"></textarea>
          <div class="lbl-row"><p class="hint">Maks 256 KB.</p><span id="htmlCount" class="count">0 B / 256 KB</span></div>
          <p class="hint">Setiap render menambah satu commit di branch utama repo. Isinya dijalankan sebagai kode di Chrome pada runner GitHub Actions, jadi tempel hanya kode yang Anda percaya. Tombol <em>Isi dari contoh</em> memuat templat komposisi 5 detik sebagai titik awal.</p>
        </div>
      </div>

      <div class="grid">
        <div class="field" id="fieldComp">
          <label for="composition">Komposisi</label>
          <input id="composition" type="text" value="contoh" maxlength="64" autocapitalize="off" spellcheck="false" required>
          <p class="hint">Nama folder di <code>cloudflare-free/compositions/</code></p>
        </div>
        <div class="field">
          <span class="lbl" id="lbl-q">Kualitas</span>
          <div class="seg" data-for="quality" role="group" aria-labelledby="lbl-q">
            <button type="button" data-value="draft" aria-pressed="false">Draft</button>
            <button type="button" data-value="standard" aria-pressed="true">Standard</button>
            <button type="button" data-value="high" aria-pressed="false">High</button>
          </div>
          <select id="quality" class="sr-only" tabindex="-1" aria-hidden="true">
            <option value="draft">draft (tercepat)</option>
            <option value="standard" selected>standard</option>
            <option value="high">high (paling lama)</option>
          </select>
          <p class="hint">Draft tercepat, High paling lama.</p>
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

  <section class="card" aria-labelledby="t-asset">
    <div class="sec-h">
      <span class="num" aria-hidden="true">2</span>
      <div><h2 id="t-asset">Aset avatar <span class="h-meta">(opsional)</span></h2><p>Unggah video avatar (mis. hasil HeyGen).</p></div>
    </div>
    <p class="hint">Diunggah sebagai commit terpisah ke <code>cloudflare-free/compositions/&lt;komposisi&gt;/assets/&lt;nama file&gt;</code>.
      Lakukan ini <strong>sebelum</strong> menekan "Mulai render" di atas, supaya filenya sudah ada di repo
      saat komposisi dirender.</p>
    <div class="mt14"></div>
    <div class="field">
      <label for="assetComp">Nama komposisi</label>
      <input id="assetComp" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="sama dengan nama komposisi di atas">
      <p class="hint">Harus sudah ditentukan (tidak boleh kosong/otomatis). Tersalin otomatis dari field
        "Komposisi" / "Nama komposisi" di atas bila kosong saat tombol diklik.</p>
    </div>
    <div class="field">
      <label for="assetFile">File video</label>
      <input id="assetFile" type="file" accept="video/mp4,video/*">
    </div>
    <div class="field">
      <label for="assetName">Nama file di repo</label>
      <input id="assetName" type="text" maxlength="128" autocapitalize="off" spellcheck="false" placeholder="mis. heygen-avatar.mp4">
      <p class="hint">Huruf, angka, <code>.</code> <code>_</code> <code>-</code>, maks 128, maks 8 MB. Terisi
        otomatis dari nama file saat dipilih. Mengunggah ulang nama yang sama menimpa aset lama (berbeda
        dari komposisi <code>index.html</code>, yang tidak pernah ditimpa).</p>
    </div>
    <button type="button" id="assetUploadBtn">Unggah aset</button>
    <div id="assetMsg" class="msg" role="alert" hidden></div>
    <div id="assetResult" class="mt14" hidden>
      <p class="hint">Tempel ini sebagai <code>src</code> di tag <code>&lt;video&gt;</code> komposisi:</p>
      <div class="row mt10">
        <input id="assetSrc" type="text" readonly spellcheck="false">
        <button type="button" id="assetCopySrc" class="small">Salin</button>
      </div>
      <button type="button" id="assetInsertBtn" class="small mt10" hidden>Sisipkan tag &lt;video&gt; ke isi komposisi</button>
    </div>
  </section>

  <section class="card" id="jobCard" aria-labelledby="t-job" hidden>
    <div class="top">
      <div class="sec-h">
        <span class="num" aria-hidden="true">3</span>
        <div><h2 id="t-job">Status</h2></div>
      </div>
      <span id="badge" class="badge" role="status" aria-live="polite"></span>
    </div>
    <div class="prog" id="prog" hidden><span></span></div>
    <div class="lbl-row"><span id="elapsed" class="h-meta"></span></div>
    <dl class="kv mt10">
      <div><dt>ID</dt><dd><code id="jId"></code></dd></div>
      <div><dt>Komposisi</dt><dd id="jComp"></dd></div>
      <div><dt>Kualitas</dt><dd id="jQual"></dd></div>
      <div><dt>Ukuran</dt><dd id="jSize">-</dd></div>
    </dl>
    <div id="jNote" class="msg" hidden></div>
    <div class="mt14"></div>
    <video id="video" controls preload="metadata" playsinline hidden></video>
    <div class="actions">
      <a id="dl" class="btn solid" href="#" download hidden>Unduh MP4</a>
      <a id="runLink" class="btn" href="#" target="_blank" rel="noopener noreferrer" hidden>Buka log di GitHub</a>
      <button type="button" id="copyVideo" hidden>Salin tautan video</button>
      <button type="button" id="copyPage" hidden>Salin tautan halaman</button>
      <button type="button" id="stop" class="danger" hidden>Berhenti memantau</button>
      <button type="button" id="recheck" hidden>Cek lagi</button>
    </div>
  </section>

  <section class="card" aria-labelledby="t-hist">
    <div class="top">
      <div class="sec-h">
        <span class="num" aria-hidden="true">4</span>
        <div><h2 id="t-hist">Riwayat</h2><p>Tersimpan di perangkat ini.</p></div>
      </div>
      <button type="button" id="clearHist" class="small danger" hidden>Hapus riwayat</button>
    </div>
    <ul id="hist" class="hist"></ul>
    <p id="histEmpty" class="empty">Belum ada render.</p>
    <details>
      <summary>Pantau ID yang sudah ada</summary>
      <div class="row mt10">
        <input id="manualId" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="ID render">
        <button type="button" id="manualGo">Pantau</button>
      </div>
      <p>Tidak butuh API key. Cukup untuk memutar atau mengunduh hasil yang sudah selesai.</p>
    </details>
  </section>

  <footer>
    Render yang gagal atau dibatalkan ditandai otomatis oleh workflow. Bila status tak kunjung berubah, cek log workflow <em>Render video</em> di tab Actions GitHub.
  </footer>
</main>

<script nonce="__NONCE__">
(function () {
  'use strict';

  var ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  var RUN_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/;
  var KEY_STORE = 'hf_api_key';
  var HIST_STORE = 'hf_history';
  var HIST_MAX = 12;
  var MAX_HTML_BYTES = 256 * 1024; // sama dengan batas di Worker
  var MAX_ASSET_BYTES = 8 * 1024 * 1024; // sama dengan batas di Worker
  var ASSET_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
  var MAX_WAIT_MS = 35 * 60 * 1000; // workflow dibatasi 30 menit + antrean
  var STATUS_TIMEOUT_MS = 15000;
  var POST_TIMEOUT_MS = 25000;
  // Templat komposisi 5 detik; disisipkan Worker (salinan compositions/contoh/index.html).
  var TEMPLATE = __TEMPLATE_JSON__;

  function $(id) { return document.getElementById(id); }
  var el = {
    form: $('form'), apikey: $('apikey'), toggleKey: $('toggleKey'), remember: $('remember'),
    mode: $('mode'), newBox: $('newBox'), newName: $('newName'), html: $('html'), tplBtn: $('tplBtn'),
    htmlCount: $('htmlCount'), htmlFile: $('htmlFile'), htmlFileMsg: $('htmlFileMsg'),
    fieldComp: $('fieldComp'),
    composition: $('composition'), quality: $('quality'), rid: $('rid'),
    submit: $('submit'), formMsg: $('formMsg'),
    assetComp: $('assetComp'), assetFile: $('assetFile'), assetName: $('assetName'),
    assetUploadBtn: $('assetUploadBtn'), assetMsg: $('assetMsg'),
    assetResult: $('assetResult'), assetSrc: $('assetSrc'), assetCopySrc: $('assetCopySrc'),
    assetInsertBtn: $('assetInsertBtn'),
    jobCard: $('jobCard'), badge: $('badge'), prog: $('prog'), elapsed: $('elapsed'),
    jId: $('jId'), jComp: $('jComp'), jQual: $('jQual'), jSize: $('jSize'), jNote: $('jNote'),
    video: $('video'), dl: $('dl'), runLink: $('runLink'), copyVideo: $('copyVideo'), copyPage: $('copyPage'),
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

  /* ---------- segmented control ----------
   * Tombol hanya lapisan tampilan: nilai sebenarnya tetap di <select> tersembunyi,
   * jadi seluruh logika lama (el.mode.value, el.quality.value) tidak berubah. */
  function initSegs() {
    var segs = document.querySelectorAll('.seg');
    Array.prototype.forEach.call(segs, function (seg) {
      var sel = $(seg.getAttribute('data-for'));
      if (!sel) return;
      function sync() {
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-value') === sel.value ? 'true' : 'false');
        });
      }
      seg.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (!b || !seg.contains(b)) return;
        sel.value = b.getAttribute('data-value');
        sel.dispatchEvent(new Event('change'));
        sync();
      });
      sel.addEventListener('change', sync);
      sync();
    });
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
        status: (it.status === 'done' || it.status === 'timeout' || it.status === 'failed') ? it.status : 'pending'
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

  var STATUS_LABEL = { pending: 'diproses', done: 'selesai', timeout: 'tidak selesai', failed: 'gagal' };
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
  function byteLen(str) {
    try { return new TextEncoder().encode(str).length; }
    catch (e) { return str.length; }
  }

  // Penghitung ukuran isi komposisi; merah bila melewati batas Worker.
  function updateCount() {
    var n = byteLen(el.html.value);
    el.htmlCount.textContent = fmtBytes(n) + ' / 256 KB';
    el.htmlCount.className = 'count' + (n > MAX_HTML_BYTES ? ' over' : '');
  }
  el.html.addEventListener('input', updateCount);

  function renderHist() {
    var list = loadHist();
    el.hist.textContent = '';
    el.histEmpty.hidden = list.length > 0;
    el.clearHist.hidden = list.length === 0;
    list.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'st-' + it.status;

      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');

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
      open.textContent = it.status === 'done' ? 'Putar' : (it.status === 'failed' ? 'Detail' : 'Pantau');
      open.addEventListener('click', function () { track(it.id, it.composition, it.quality, it.ts); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'small danger';
      del.textContent = 'Hapus';
      del.addEventListener('click', function () { removeHist(it.id); renderHist(); });
      btns.appendChild(open);
      btns.appendChild(del);

      li.appendChild(dot);
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
      case 'invalid_html': return 'Isi komposisi tidak valid atau kosong.';
      case 'html_too_large': return 'Isi komposisi terlalu besar (maks 256 KB).';
      case 'composition_already_exists': return 'Nama komposisi sudah ada di repo dan tidak ditimpa. Kosongkan nama (otomatis) atau pilih nama lain.';
      case 'commit_failed': {
        var c = data && data.github_status;
        var cbase = 'Gagal meng-commit komposisi ke repo' + (c ? ' (GitHub ' + c + ')' : '') + '.';
        if (c === 404) return cbase + ' Token salah atau tidak punya akses ke repo.';
        if (c === 403) return cbase + ' Izin token Contents belum Read and write.';
        if (c === 401) return cbase + ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
        if (c === 409) return cbase + ' Ada commit lain yang bersamaan, coba lagi.';
        return cbase;
      }
      case 'dispatch_failed': {
        var g = data && data.github_status;
        var base = 'Gagal memicu GitHub Actions' + (g ? ' (GitHub ' + g + ')' : '') + '.';
        var tail = '';
        if (g === 404) tail = ' Token salah atau tidak punya akses ke repo.';
        else if (g === 403) tail = ' Izin token Contents belum Read and write.';
        else if (g === 401) tail = ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
        var note = (data && data.committed && typeof data.composition === 'string')
          ? ' Komposisi "' + data.composition + '" sudah ter-commit; coba lagi lewat mode komposisi yang sudah ada.'
          : '';
        return base + tail + note;
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
    // Progress bar indeterminate hanya tampil selama render berjalan.
    el.prog.hidden = kind !== 'run';
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
    el.runLink.hidden = !o.link;
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

    // 410: workflow menandai render ini gagal atau dibatalkan.
    if (res && res.status === 410) {
      var fd = {};
      try { fd = await res.json(); } catch (e) { fd = {}; }
      if (current !== job) return;
      failJob(job, fd);
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

  function failJob(job, d) {
    stopTimers(job);
    var cancelled = !!(d && d.reason === 'cancelled');
    setBadge('bad', cancelled ? 'Dibatalkan' : 'Gagal');
    el.elapsed.textContent = '';
    setNote(cancelled
      ? 'Render dibatalkan di GitHub Actions. Jalankan lagi dari form bila perlu.'
      : 'Render gagal di GitHub Actions. Buka log untuk melihat sebabnya, perbaiki komposisinya, lalu jalankan lagi.', 'err');
    // Tautan hanya dipakai bila cocok bentuk tautan run GitHub (validasi ulang di klien).
    var url = (d && typeof d.run_url === 'string' && RUN_URL_RE.test(d.run_url)) ? d.run_url : '';
    if (url) el.runLink.href = url;
    setButtons({ link: !!url });
    upsertHist({ id: job.id, composition: job.comp, quality: job.qual, ts: job.start, status: 'failed' });
    renderHist();
  }

  function timeout(job) {
    stopTimers(job);
    setBadge('bad', 'Belum selesai');
    el.elapsed.textContent = '';
    setNote('Belum selesai setelah 35 menit dan tidak ada penanda gagal. Kemungkinan runner berhenti mendadak atau secret R2 belum diset: cek log workflow "Render video" di tab Actions GitHub.', 'err');
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
  function applyMode() {
    var isNew = el.mode.value === 'new';
    el.newBox.hidden = !isNew;
    el.fieldComp.hidden = isNew;
  }
  el.mode.addEventListener('change', applyMode);

  /* ---------- unggah file komposisi (.html) ----------
   * File dibaca di browser (FileReader) dan dimasukkan ke textarea; pengiriman tetap lewat
   * form "Mulai render" (POST /render dengan field html), jadi tidak ada endpoint baru. */
  function fileMsg(text, kind) {
    if (!text) { el.htmlFileMsg.hidden = true; el.htmlFileMsg.textContent = ''; return; }
    el.htmlFileMsg.className = 'msg' + (kind ? ' ' + kind : '');
    el.htmlFileMsg.textContent = text;
    el.htmlFileMsg.hidden = false;
  }
  function nameFromFile(name) {
    var base = String(name || '').replace(/\.[^.]*$/, '');
    var cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+/, '').slice(0, 64);
    return ID_RE.test(cleaned) ? cleaned : '';
  }
  el.htmlFile.addEventListener('change', function () {
    fileMsg('');
    var f = el.htmlFile.files && el.htmlFile.files[0];
    if (!f) return;
    if (f.size > MAX_HTML_BYTES) {
      fileMsg('File terlalu besar (' + fmtBytes(f.size) + '). Maks 256 KB.', 'err');
      el.htmlFile.value = '';
      return;
    }
    if (el.html.value.trim() !== '' && !window.confirm('Ganti isi kotak komposisi dengan isi file "' + f.name + '"?')) {
      el.htmlFile.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () { fileMsg('File gagal dibaca. Coba pilih ulang.', 'err'); };
    reader.onload = function () {
      var text = typeof reader.result === 'string' ? reader.result : '';
      if (!text.trim()) { fileMsg('File kosong.', 'err'); return; }
      el.html.value = text;
      updateCount();
      var suggested = nameFromFile(f.name);
      var filled = false;
      if (!el.newName.value.trim() && suggested && suggested.toLowerCase() !== 'index') {
        el.newName.value = suggested;
        filled = true;
      }
      formMsg('');
      fileMsg('File "' + f.name + '" dimuat (' + fmtBytes(f.size) + ').' +
        (filled ? ' Nama komposisi diisi "' + suggested + '".' : '') +
        ' Cek isinya, lalu tekan "Mulai render".', 'ok');
    };
    reader.readAsText(f);
  });

  el.tplBtn.addEventListener('click', function () {
    if (el.html.value.trim() !== '' && !window.confirm('Ganti isi textarea dengan komposisi contoh?')) return;
    el.html.value = TEMPLATE;
    updateCount();
    formMsg('');
    el.html.focus();
  });

  el.toggleKey.addEventListener('click', function () {
    var show = el.apikey.type === 'password';
    el.apikey.type = show ? 'text' : 'password';
    el.toggleKey.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    el.toggleKey.setAttribute('aria-pressed', show ? 'true' : 'false');
  });

  /* ---------- aset avatar ---------- */
  function assetMsg(text, kind) {
    if (!text) { el.assetMsg.hidden = true; el.assetMsg.textContent = ''; return; }
    el.assetMsg.className = 'msg' + (kind ? ' ' + kind : '');
    el.assetMsg.textContent = text;
    el.assetMsg.hidden = false;
  }

  function describeAssetError(status, data) {
    var code = data && typeof data.error === 'string' ? data.error : '';
    switch (code) {
      case 'unauthorized': return 'API key salah.';
      case 'server_not_configured': return 'Server belum dikonfigurasi.';
      case 'invalid_composition': return 'Nama komposisi tidak valid atau kosong (huruf, angka, _ dan -, maks 64).';
      case 'invalid_filename': return 'Nama file tidak valid (huruf, angka, titik, _ dan -, maks 128, harus diawali huruf/angka).';
      case 'invalid_data':
      case 'invalid_base64': return 'File gagal dibaca. Coba pilih ulang filenya.';
      case 'body_too_large':
      case 'asset_too_large': return 'File terlalu besar (maks 8 MB).';
      case 'invalid_json': return 'Permintaan tidak valid.';
      case 'commit_failed': {
        var c = data && data.github_status;
        var base = 'Gagal meng-commit aset ke repo' + (c ? ' (GitHub ' + c + ')' : '') + '.';
        if (c === 404) return base + ' Token salah atau tidak punya akses ke repo.';
        if (c === 403) return base + ' Izin token Contents belum Read and write.';
        if (c === 401) return base + ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
        if (c === 409) return base + ' Ada commit lain yang bersamaan, coba lagi.';
        return base;
      }
      default: return 'Gagal (HTTP ' + status + ').';
    }
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read_failed')); };
      reader.onload = function () {
        try {
          var bytes = new Uint8Array(reader.result);
          var bin = '';
          var CHUNK = 0x8000;
          for (var i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
          }
          resolve({ base64: btoa(bin), size: bytes.length });
        } catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Nama file -> hanya karakter yang diterima server; sisanya dibuang.
  function sanitizeFilename(name) {
    var cleaned = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 128);
    cleaned = cleaned.replace(/^-+/, '');
    return cleaned || 'avatar.mp4';
  }

  el.assetFile.addEventListener('change', function () {
    var f = el.assetFile.files && el.assetFile.files[0];
    if (f && !el.assetName.value.trim()) el.assetName.value = sanitizeFilename(f.name);
    assetMsg('');
    el.assetResult.hidden = true;
  });

  var lastAssetUpload = null; // { composition, filename, src }

  el.assetUploadBtn.addEventListener('click', async function () {
    assetMsg('');
    el.assetResult.hidden = true;

    var key = el.apikey.value.trim();
    if (!key) { assetMsg('Isi API key di atas dulu.', 'err'); el.apikey.focus(); return; }

    var comp = el.assetComp.value.trim();
    if (!comp) {
      // Sinkron dari field komposisi yang sedang aktif sesuai mode saat ini.
      comp = (el.mode.value === 'new' ? el.newName.value.trim() : el.composition.value.trim());
      el.assetComp.value = comp;
    }
    if (!comp || !ID_RE.test(comp)) {
      assetMsg('Nama komposisi wajib diisi dan valid (huruf, angka, _ dan -, maks 64). Tidak bisa kosong/otomatis untuk aset.', 'err');
      el.assetComp.focus();
      return;
    }

    var file = el.assetFile.files && el.assetFile.files[0];
    if (!file) { assetMsg('Pilih file video dulu.', 'err'); el.assetFile.focus(); return; }
    if (file.size > MAX_ASSET_BYTES) { assetMsg('File terlalu besar (maks 8 MB).', 'err'); return; }

    var filename = el.assetName.value.trim() || sanitizeFilename(file.name);
    if (!ASSET_NAME_RE.test(filename)) {
      assetMsg('Nama file tidak valid (huruf, angka, titik, _ dan -, maks 128).', 'err');
      el.assetName.focus();
      return;
    }

    el.assetUploadBtn.disabled = true;
    el.assetUploadBtn.textContent = 'Mengunggah…';
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, POST_TIMEOUT_MS);
    try {
      var read = await readFileAsBase64(file);
      var res = await fetch('/asset', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ composition: comp, filename: filename, data: read.base64 }),
        cache: 'no-store',
        signal: ctrl.signal
      });
      var data = {};
      try { data = await res.json(); } catch (e) { data = {}; }

      if (res.status === 201 && data && typeof data.src === 'string') {
        assetMsg('Aset terunggah ke komposisi "' + comp + '".', 'ok');
        el.assetSrc.value = data.src;
        el.assetResult.hidden = false;
        lastAssetUpload = { composition: comp, filename: filename, src: data.src };
        var canInsert = el.mode.value === 'new' && !el.newBox.hidden;
        el.assetInsertBtn.hidden = !canInsert;
      } else {
        assetMsg(describeAssetError(res.status, data), 'err');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') assetMsg('Server tidak merespons (timeout). Coba lagi.', 'err');
      else assetMsg('Gagal mengunggah. Periksa koneksi lalu coba lagi.', 'err');
    } finally {
      clearTimeout(to);
      el.assetUploadBtn.disabled = false;
      el.assetUploadBtn.textContent = 'Unggah aset';
    }
  });

  el.assetCopySrc.addEventListener('click', function () {
    if (el.assetSrc.value) copyText(el.assetSrc.value, el.assetCopySrc);
  });

  el.assetInsertBtn.addEventListener('click', function () {
    if (!lastAssetUpload) return;
    var tag = '<video class="clip avatar" src="' + lastAssetUpload.src + '" data-start="0" ' +
      'data-duration="5" data-track-index="0" muted playsinline></video>\n';
    if (el.html.value.indexOf(lastAssetUpload.src) !== -1) {
      assetMsg('Tag untuk "' + lastAssetUpload.src + '" sepertinya sudah ada di isi komposisi.', 'warn');
      return;
    }
    var cur = el.html.value;
    var idx = cur.lastIndexOf('</body>');
    el.html.value = idx === -1 ? (cur + '\n' + tag) : (cur.slice(0, idx) + tag + cur.slice(idx));
    updateCount();
    assetMsg('Tag <video> disisipkan ke isi komposisi. Sesuaikan posisi/atribut data-start, data-duration, dst sesuai kebutuhan.', 'ok');
    el.html.focus();
  });

  el.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    formMsg('');

    var key = el.apikey.value.trim();
    var isNew = el.mode.value === 'new';
    var comp = '';
    var html = '';
    var qual = el.quality.value;
    var rid = el.rid.value.trim();

    if (!key) { formMsg('API key wajib diisi.', 'err'); el.apikey.focus(); return; }

    if (isNew) {
      comp = el.newName.value.trim();
      html = el.html.value;
      if (comp && !ID_RE.test(comp)) { formMsg('Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); el.newName.focus(); return; }
      if (!html.trim()) { formMsg('Isi komposisi wajib diisi.', 'err'); el.html.focus(); return; }
      if (byteLen(html) > MAX_HTML_BYTES) { formMsg('Isi komposisi terlalu besar (maks 256 KB).', 'err'); el.html.focus(); return; }
    } else {
      comp = el.composition.value.trim() || 'contoh';
      if (!ID_RE.test(comp)) { formMsg('Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); el.composition.focus(); return; }
    }
    if (!QUALS[qual]) { formMsg('Kualitas tidak valid.', 'err'); return; }
    if (rid && !ID_RE.test(rid)) { formMsg('ID tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); el.rid.focus(); return; }

    if (el.remember.checked) sSet('session', KEY_STORE, key); else sDel('session', KEY_STORE);

    var payload = { quality: qual };
    if (comp) payload.composition = comp;
    if (isNew) payload.html = html;
    if (rid) payload.id = rid;

    el.submit.disabled = true;
    el.submit.textContent = isNew ? 'Meng-commit & mengirim…' : 'Mengirim…';
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
        // Nama komposisi otomatis (web-ID) hanya diketahui server; pakai balasannya.
        var usedComp = (typeof data.composition === 'string' && ID_RE.test(data.composition)) ? data.composition : (comp || '-');
        upsertHist({ id: data.id, composition: usedComp, quality: qual, ts: started, status: 'pending' });
        renderHist();
        el.rid.value = '';
        track(data.id, usedComp, qual, started);
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
  initSegs();
  applyMode();
  updateCount();
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

/**
 * Templat komposisi untuk tombol "Isi dari contoh" di halaman web.
 * Salinan cloudflare-free/compositions/contoh/index.html; satu-satunya beda: komentar
 * di <head> ditulis tanpa backtick. Perbarui keduanya bersamaan bila contoh berubah.
 * Syarat isi: tanpa backtick dan tanpa ${ (literal String.raw), tanpa teks __NONCE__.
 */
const COMPOSITION_TEMPLATE = String.raw`<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <!-- Struktur mengikuti template resmi "blank" (packages/cli/src/templates/blank). -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {
        --ground: #0b1020;
        --ink: #ffffff;
        --accent: #38bdf8;
        --font-display: sans-serif;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: var(--ground);
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 28px;
        font-family: var(--font-display);
        background: linear-gradient(135deg, #0b1020 0%, #172554 100%);
      }
      #bar {
        width: 480px;
        height: 10px;
        border-radius: 5px;
        background: var(--accent);
        transform-origin: left center;
      }
      #title {
        color: var(--ink);
        font-size: 120px;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      #subtitle {
        color: #cbd5e1;
        font-size: 48px;
        font-weight: 400;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="5"
      data-width="1920"
      data-height="1080"
    >
      <div id="bar" class="clip" data-start="0" data-duration="5" data-track-index="0"></div>
      <h1 id="title" class="clip" data-start="0" data-duration="5" data-track-index="1">Halo, HyperFrames</h1>
      <p id="subtitle" class="clip" data-start="0.6" data-duration="4.4" data-track-index="2">
        Dirender di Cloudflare Free + GitHub Actions
      </p>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // Aksen sudah tampil di frame 0 (thumbnail tidak kosong), lalu melebar.
      tl.fromTo("#bar", { scaleX: 0.2 }, { scaleX: 1, duration: 1.2, ease: "power3.out" }, 0);
      tl.fromTo("#title", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.1);
      tl.fromTo("#subtitle", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.6);
      // Gerak lambat sampai akhir supaya tidak ada "dead stretch" > 3 detik.
      tl.to("#root", { backgroundPosition: "20% 20%", duration: 5, ease: "none" }, 0);
      tl.to("#title", { scale: 1.04, duration: 3.8, ease: "none" }, 1.2);
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;

// Literal string JS aman untuk disisipkan di <script>: "<" di-escape agar tak ada "</script>" atau "<!--" mentah.
const TEMPLATE_JSON = JSON.stringify(COMPOSITION_TEMPLATE).replace(/</g, "\\u003c");
