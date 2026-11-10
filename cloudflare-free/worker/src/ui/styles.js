/**
 * Design system HyperFrames Studio (CSS).
 *
 * KEPUTUSAN:
 *  - Semua warna/radius/bayangan lewat CSS variable di :root (token). Tema gelap adalah default
 *    (Midnight Navy #080D19, Surface #111827, Electric Blue #246BFD). Tema terang dipasang lewat
 *    atribut data-theme="light" ATAU otomatis (prefers-color-scheme) bila pengguna memilih "Otomatis".
 *    Blok token terang ditulis sekali (LIGHT) dan dipakai di dua selektor.
 *  - TIDAK ada atribut style="..." di markup: CSP hanya mengizinkan <style nonce>. Gaya dinamis
 *    (mis. lebar progress bar) diatur dari JS lewat element.style, yang tetap diizinkan CSP.
 *  - Mobile-first: dasar = layar HP. >=1024px: sidebar tetap; <1024px: bottom tab bar.
 *  - Input 16px agar iOS Safari tidak zoom saat fokus; target sentuh >= 40px.
 *  - Blur kartu tidak dipakai (hanya top bar mobile) supaya scroll tetap ringan di HP kelas bawah.
 *
 * ATURAN: jangan memakai backtick atau ${ di dalam String.raw ini.
 */

const DARK = String.raw`:root{
  color-scheme:dark;
  --bg:#080D19;--bg2:#0b1222;--surface:#111827;--surface2:#0e1626;--elev:#172033;
  --line:rgba(148,163,184,.14);--line2:rgba(148,163,184,.28);
  --text:#e9eefb;--mut:#9aa7c2;--faint:#6b7893;
  --acc:#246BFD;--acc-t:#6ea0ff;--acc-ring:rgba(36,107,253,.4);--acc-soft:rgba(36,107,253,.14);--on-acc:#fff;
  --ok:#34d399;--warn:#fbbf24;--err:#fb7185;--vio:#a78bfa;
  --ok-soft:rgba(52,211,153,.14);--warn-soft:rgba(251,191,36,.14);--err-soft:rgba(251,113,133,.14);
  --shadow:0 1px 0 rgba(255,255,255,.04) inset,0 18px 40px -24px rgba(0,0,0,.8);
  --r:14px;--r-sm:10px;--r-lg:18px;
  --font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --nav-w:236px;--tab-h:62px;
}`;

const LIGHT =
  "color-scheme:light;" +
  "--bg:#f3f6fc;--bg2:#e9eef8;--surface:#ffffff;--surface2:#eef2f9;--elev:#ffffff;" +
  "--line:rgba(15,23,48,.11);--line2:rgba(15,23,48,.26);" +
  "--text:#0f1730;--mut:#4a5876;--faint:#76829e;" +
  "--acc:#1f5be0;--acc-t:#1f5be0;--acc-ring:rgba(31,91,224,.3);--acc-soft:rgba(31,91,224,.1);" +
  "--ok:#0f8a5f;--warn:#a86a0a;--err:#cf3a52;--vio:#6d4de0;" +
  "--ok-soft:rgba(15,138,95,.12);--warn-soft:rgba(168,106,10,.12);--err-soft:rgba(207,58,82,.1);" +
  "--shadow:0 1px 0 #fff inset,0 14px 30px -22px rgba(15,23,48,.35);";

const THEME_CSS =
  ":root[data-theme=light]{" + LIGHT + "}\n" +
  "@media (prefers-color-scheme: light){:root:not([data-theme]){" + LIGHT + "}}\n";

const BASE = String.raw`
/* ============ Dasar ============ */
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--text);
  font:14.5px/1.55 var(--font);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
}
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(60rem 30rem at 85% -12%,var(--acc-soft),transparent 60%),
    radial-gradient(40rem 24rem at -6% 108%,rgba(167,139,250,.07),transparent 60%);
}
a{color:var(--acc-t)}
h1,h2,h3{margin:0;letter-spacing:-.015em}
p{margin:0}
code{font:12.5px var(--mono)}
::selection{background:var(--acc-ring)}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.clip-fallback{position:fixed;top:0;left:0;opacity:0;pointer-events:none}
.skip{position:absolute;left:12px;top:-64px;z-index:100;padding:10px 14px;border-radius:10px;background:var(--acc);color:#fff;text-decoration:none;font-weight:600}
.skip:focus{top:12px}
:focus-visible{outline:2px solid var(--acc-t);outline-offset:2px}
.muted{color:var(--mut)}
.mt{margin-top:14px}
.mt-s{margin-top:8px}

/* ============ Shell ============ */
.side{display:none}
.col{min-width:0}
.logo{display:block;width:32px;height:32px;flex:none}
.mtop{
  position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;
  padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));
  background:var(--bg);background:color-mix(in srgb,var(--bg) 82%,transparent);
  -webkit-backdrop-filter:saturate(150%) blur(12px);backdrop-filter:saturate(150%) blur(12px);
  border-bottom:1px solid var(--line);
}
.mtop .logo{width:28px;height:28px}
.mtop b{font-size:15px;letter-spacing:-.01em}
.mtop .sep{color:var(--faint)}
.mtop .mt-title{color:var(--mut);font-weight:600;font-size:14px}
main{
  max-width:1180px;margin:0 auto;outline:none;
  padding:20px max(16px,env(safe-area-inset-right,0px)) calc(var(--tab-h) + 28px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));
}
.tabbar{
  position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);align-items:end;
  padding:6px max(8px,env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-left,0px));
  background:var(--surface);border-top:1px solid var(--line);
}
.tabbar a{
  position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  min-height:48px;border-radius:12px;text-decoration:none;color:var(--mut);font-size:11px;font-weight:600;
}
.tabbar a[aria-current=page]{color:var(--acc-t)}
.tabbar .tab-new .tabi{
  display:grid;place-items:center;width:46px;height:34px;border-radius:12px;background:var(--acc);color:#fff;
  box-shadow:0 8px 20px -8px var(--acc);
}
.tabbar .tab-new[aria-current=page] .tabi{box-shadow:0 0 0 3px var(--acc-ring)}
.nbadge{
  position:absolute;top:2px;left:calc(50% + 6px);min-width:18px;height:18px;padding:0 5px;border-radius:99px;
  background:var(--warn);color:#1a1300;font-size:11px;font-weight:800;line-height:18px;text-align:center;
}

@media (min-width:1024px){
  .app{display:grid;grid-template-columns:var(--nav-w) minmax(0,1fr)}
  .side{
    display:flex;flex-direction:column;gap:20px;position:sticky;top:0;height:100vh;height:100dvh;
    padding:20px 14px;border-right:1px solid var(--line);background:var(--bg2);
  }
  .mtop,.tabbar{display:none}
  main{padding:32px 40px 56px}
  .side .brand{display:flex;align-items:center;gap:10px;padding:2px 8px;text-decoration:none;color:var(--text)}
  .side .brand b{font-size:16px;letter-spacing:-.01em;display:block;line-height:1.1}
  .side .brand small{display:block;color:var(--mut);font-size:12px;font-weight:500}
  .nav{display:flex;flex-direction:column;gap:4px}
  .nav a{
    position:relative;display:flex;align-items:center;gap:12px;min-height:42px;padding:8px 12px;border-radius:10px;
    color:var(--mut);text-decoration:none;font-weight:600;transition:background .15s,color .15s;
  }
  .nav a:hover{background:var(--elev);color:var(--text)}
  .nav a[aria-current=page]{background:var(--acc-soft);color:var(--text)}
  .nav a[aria-current=page]::before{content:"";position:absolute;left:-14px;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--acc)}
  .nav a.nav-new{margin-bottom:6px;background:var(--acc);color:#fff;box-shadow:0 10px 24px -12px var(--acc)}
  .nav a.nav-new:hover{background:var(--acc);filter:brightness(1.1);color:#fff}
  .nav a.nav-new[aria-current=page]::before{display:none}
  .nav .nbadge{position:static;margin-left:auto}
  .side-foot{margin-top:auto;padding:0 8px;color:var(--faint);font-size:12px;line-height:1.5}
  .toasts{bottom:24px!important;right:24px!important;left:auto!important;transform:none!important;align-items:flex-end!important}
}

/* ============ Halaman ============ */
.view{animation:fade .3s ease both}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.view-h{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 20px}
.view-h h1{font-size:clamp(22px,4.6vw,30px);line-height:1.15;font-weight:800}
.sub{color:var(--mut);margin-top:4px;font-size:14px}
.h2{font-size:16px;font-weight:700;margin:0 0 4px}
.h2-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.card{
  background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin:0 0 16px;
  box-shadow:var(--shadow);
}
.two{display:grid;gap:0 16px;align-items:start}
.grid2{display:grid;gap:0 14px;grid-template-columns:1fr}
@media (min-width:640px){.grid2{grid-template-columns:1fr 1fr}}
@media (min-width:1100px){.two{grid-template-columns:minmax(0,1fr) 340px}}

/* ============ Tombol ============ */
button{font:inherit;color:inherit}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 14px;
  border-radius:10px;border:1px solid var(--line2);background:var(--elev);color:var(--text);
  font-weight:600;font-size:14px;line-height:1.2;text-decoration:none;cursor:pointer;
  transition:border-color .15s,background .15s,filter .15s,transform .1s,color .15s;
}
.btn:hover:not(:disabled){border-color:var(--acc-t)}
.btn:active:not(:disabled){transform:scale(.985)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.solid{background:var(--acc);border-color:var(--acc);color:var(--on-acc);box-shadow:0 8px 22px -12px var(--acc)}
.btn.solid:hover:not(:disabled){filter:brightness(1.1);border-color:var(--acc)}
.btn.lg{min-height:48px;padding:10px 18px;font-size:15px}
.btn.sm{min-height:34px;padding:5px 10px;font-size:13px}
.btn.icon{width:40px;padding:0}
.btn.sm.icon{width:34px}
.btn.block{width:100%}
.btn.ghost{background:transparent;border-color:transparent;color:var(--mut)}
.btn.ghost:hover:not(:disabled){color:var(--text);background:var(--elev);border-color:var(--line)}
.btn.danger:hover:not(:disabled){border-color:var(--err);color:var(--err)}
.btn.danger-solid{background:var(--err);border-color:var(--err);color:#fff}
.actions{display:flex;flex-wrap:wrap;gap:8px}

/* ============ Form ============ */
.field{display:flex;flex-direction:column;gap:6px;margin:0 0 16px;min-width:0}
label,.lbl{font-size:13px;font-weight:600;color:var(--mut)}
.lbl-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
input[type=text],input[type=password],input[type=search],select,textarea{
  width:100%;min-height:44px;padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--line);
  background:var(--surface2);color:var(--text);font:inherit;font-size:16px;
  transition:border-color .15s,box-shadow .15s;
}
input::placeholder,textarea::placeholder{color:var(--faint)}
input:hover,select:hover,textarea:hover{border-color:var(--line2)}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none;border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-ring)}
textarea{min-height:240px;resize:vertical;white-space:pre;overflow:auto;tab-size:2;font-family:var(--mono);line-height:1.55}
@media (min-width:641px){textarea{font-size:13px}}
.search{position:relative;flex:1 1 180px;min-width:0}
.search .i{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--faint);pointer-events:none}
.search input{padding-left:38px}
.row-in{display:flex;gap:8px}
.row-in>input{flex:1;min-width:0}
.hint{font-size:12.5px;line-height:1.5;color:var(--faint)}
.hint code,.sub code,.msg code,td code{color:var(--mut)}
.count{font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}
.count.over{color:var(--err);font-weight:700}
.check{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--mut);cursor:pointer;line-height:1.45;margin:0 0 14px}
.check input{
  appearance:none;-webkit-appearance:none;flex:none;width:20px;height:20px;margin:0;border-radius:6px;
  border:1px solid var(--line2);background:var(--surface2);display:grid;place-content:center;cursor:pointer;
}
.check input::after{content:"";width:10px;height:6px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);margin-top:-2px;transition:transform .12s}
.check input:checked{background:var(--acc);border-color:var(--acc)}
.check input:checked::after{transform:rotate(-45deg) scale(1)}

.seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;border-radius:12px;border:1px solid var(--line);background:var(--surface2)}
.seg button{
  border:1px solid transparent;background:transparent;color:var(--mut);cursor:pointer;border-radius:9px;
  min-height:38px;padding:6px 10px;font-size:14px;font-weight:600;line-height:1.2;transition:background .15s,color .15s;
}
.seg button:hover{color:var(--text)}
.seg button[aria-pressed=true]{background:var(--elev);color:var(--text);border-color:var(--line2)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button{
  min-height:34px;padding:4px 12px;border-radius:99px;border:1px solid var(--line);background:transparent;
  color:var(--mut);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,color .15s;
}
.chips button:hover{color:var(--text);border-color:var(--line2)}
.chips button[aria-pressed=true]{background:var(--acc-soft);border-color:var(--acc);color:var(--text)}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px}

.drop{
  display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 16px;text-align:center;cursor:pointer;
  border:1.5px dashed var(--line2);border-radius:var(--r);background:var(--surface2);color:var(--mut);
  transition:border-color .15s,background .15s;
}
.drop:hover,.drop.over{border-color:var(--acc);background:var(--acc-soft)}
.drop:focus-within{outline:2px solid var(--acc-t);outline-offset:2px}
.drop b{color:var(--text);font-size:14px}
.drop .i{width:26px;height:26px;color:var(--acc-t)}

/* ============ Status, pesan, toast ============ */
.msg{margin:12px 0 0;padding:10px 14px;border-radius:var(--r-sm);font-size:14px;line-height:1.5;border:1px solid var(--line);border-left-width:3px;background:var(--surface2)}
.msg.err{border-color:var(--err);border-color:color-mix(in srgb,var(--err) 45%,transparent);border-left-color:var(--err);color:var(--err)}
.msg.ok{border-color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);border-left-color:var(--ok);color:var(--ok)}
.msg.warn{border-color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);border-left-color:var(--warn);color:var(--warn)}
.keybar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface2);font-size:13px;margin:0 0 16px}
.keybar .kb-t{flex:1 1 220px;color:var(--mut)}
.keybar.ok{border-color:var(--ok);border-color:color-mix(in srgb,var(--ok) 40%,transparent)}
.keybar.ok .i{color:var(--ok)}
.keybar.warn{border-color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
.keybar.warn .i{color:var(--warn)}
.badge{
  display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;
  border:1px solid var(--line);background:var(--surface2);color:var(--mut);white-space:nowrap;
}
.badge.run{color:var(--warn);background:var(--warn-soft);border-color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.badge.done{color:var(--ok);background:var(--ok-soft);border-color:var(--ok);border-color:color-mix(in srgb,var(--ok) 40%,transparent)}
.badge.bad{color:var(--err);background:var(--err-soft);border-color:var(--err);border-color:color-mix(in srgb,var(--err) 40%,transparent)}
.spin{width:10px;height:10px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.prog{height:4px;border-radius:99px;background:var(--line);overflow:hidden;position:relative;margin:0 0 14px}
.prog span{position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:inherit;background:var(--acc);animation:slide 1.5s ease-in-out infinite}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(270%)}}
.bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden}
.bar span{display:block;height:100%;width:0;border-radius:inherit;background:var(--acc);transition:width .15s linear}
.bar.ok span{background:var(--ok)}
.bar.bad span{background:var(--err)}

.toasts{
  position:fixed;z-index:80;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;
  bottom:calc(var(--tab-h) + 14px + env(safe-area-inset-bottom,0px));width:min(92vw,420px);pointer-events:none;
}
.toast{
  pointer-events:auto;width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--line2);background:var(--elev);
  box-shadow:0 14px 34px -14px rgba(0,0,0,.7);font-size:14px;font-weight:600;animation:toast-in .22s ease both;
}
.toast.ok{border-left:3px solid var(--ok)}
.toast.err{border-left:3px solid var(--err)}
.toast.warn{border-left:3px solid var(--warn)}
.toast.out{opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}
@keyframes toast-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.dlg{
  border:1px solid var(--line2);border-radius:var(--r-lg);background:var(--surface);color:var(--text);padding:20px;
  width:min(92vw,420px);max-height:90vh;max-height:90dvh;overflow:auto;box-shadow:0 30px 80px -20px rgba(0,0,0,.8);
}
.dlg.wide{width:min(94vw,860px)}
.dlg::backdrop{background:rgba(3,6,14,.66)}
.dlg h2{font-size:17px;margin:0 0 8px}
.dlg p{color:var(--mut)}
.dlg-act{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap}
.dlg-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 12px}
.pv video,.pv img{display:block;width:100%;max-height:70vh;max-height:70dvh;object-fit:contain;background:#000;border-radius:12px}
.pv audio{width:100%}

/* ============ Dashboard ============ */
.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 16px}
@media (min-width:640px){.stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stat{padding:14px 16px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow)}
.stat span{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.stat b{display:block;font-size:28px;line-height:1.2;font-weight:800;font-variant-numeric:tabular-nums}
.qa{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 16px}
@media (min-width:640px){.qa{grid-template-columns:repeat(4,minmax(0,1fr))}}
.qa .btn{justify-content:flex-start;min-height:48px;background:var(--surface)}
.qa .i{color:var(--acc-t)}
.onboard{border-color:var(--acc);border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}
.steps{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:10px}
@media (min-width:800px){.steps{grid-template-columns:repeat(3,1fr)}}
.steps li{display:flex;gap:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2)}
.steps p{color:var(--mut);font-size:13px;margin:2px 0 6px}
.stepn{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:13px;background:var(--acc-soft);color:var(--acc-t)}
.steps li.done .stepn{background:var(--ok);color:#06251a}
.pgrid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}
.pcard{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:var(--r);background:var(--surface2);overflow:hidden;transition:border-color .15s,transform .15s}
.pcard:hover{border-color:var(--acc-t);transform:translateY(-2px)}
.thumb{position:relative;aspect-ratio:16/9;display:grid;place-items:center;overflow:hidden;color:var(--faint);background:var(--elev)}
.thumb .i{width:30px;height:30px}
.thumb-v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}
.thumb.ready .thumb-v{opacity:1}
.thumb.loading::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%);transform:translateX(-100%);animation:shimmer 1.4s infinite}
@keyframes shimmer{to{transform:translateX(100%)}}
.thumb .badge{position:absolute;left:8px;top:8px}
.pbody{padding:10px 12px 12px;min-width:0}
.pname{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pid{display:block;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pmeta{display:block;margin-top:4px;font-size:12px;color:var(--faint)}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:30px 16px;color:var(--mut)}
.empty-state .i{width:34px;height:34px;color:var(--faint)}
.empty-state b{color:var(--text);font-size:15px}
.empty-state p{max-width:42ch;font-size:13.5px}

/* ============ Baris daftar (riwayat, antrean, aset, draf) ============ */
.rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);transition:border-color .15s,background .15s}
.row:hover{border-color:var(--line2)}
.row.active{border-color:var(--acc);background:var(--acc-soft)}
.row-a{display:flex;align-items:center;gap:12px;flex:1 1 200px;min-width:0;color:inherit;text-decoration:none}
.dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--faint)}
.st-done .dot{background:var(--ok);box-shadow:0 0 0 4px var(--ok-soft)}
.st-pending .dot{background:var(--warn);box-shadow:0 0 0 4px var(--warn-soft)}
.st-failed .dot,.st-timeout .dot{background:var(--err);box-shadow:0 0 0 4px var(--err-soft)}
.h-info{min-width:0;flex:1 1 180px}
.h-info code,.h-info b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.h-meta{display:block;font-size:12.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.row-acts{display:flex;gap:6px;flex-wrap:wrap}
.tile{flex:none;width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--elev);color:var(--acc-t)}
.tile.cat-avatar{color:var(--vio)}
.tile.cat-audio{color:var(--ok)}
.tile.cat-image{color:var(--warn)}
.tile.cat-other{color:var(--mut)}
.arow .srcc{display:block;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qrow{display:block}
.qrow .q-top{display:flex;align-items:center;gap:10px}
.qrow .bar{margin-top:8px;flex:1 0 100%}
.q-st{font-size:12.5px;color:var(--mut);font-variant-numeric:tabular-nums}
.q-st.err{color:var(--err)}
.q-st.ok{color:var(--ok)}

/* ============ Render Center ============ */
.rc{display:grid;gap:16px;align-items:start}
.rc .rc-detail{display:none}
.rc.has-detail .rc-list{display:none}
.rc.has-detail .rc-detail{display:block}
.back{display:inline-flex;align-items:center;gap:6px;margin:0 0 12px;color:var(--mut);text-decoration:none;font-weight:600;font-size:14px;min-height:36px}
.back:hover{color:var(--text)}
@media (min-width:1024px){
  .rc{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}
  .rc .rc-detail,.rc.has-detail .rc-list{display:block}
  .back{display:none}
  .rc-list{position:sticky;top:20px;max-height:calc(100dvh - 40px);overflow:auto}
}
.rd-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.rd-h code{font-size:13px;word-break:break-all;font-weight:700}
.vid{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;border:1px solid var(--line);margin:0 0 14px}
.vid video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.vid .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#9aa7c2;text-align:center;padding:12px;font-size:13.5px}
.vid .ph .i{width:34px;height:34px}
.kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 14px}
@media (min-width:640px){.kv{grid-template-columns:repeat(3,minmax(0,1fr))}}
.kv>div{padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--surface2);min-width:0}
.kv dt{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin:0 0 2px}
.kv dd{margin:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
details{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}
details summary{cursor:pointer;color:var(--mut);font-size:14px;font-weight:600;min-height:32px;display:flex;align-items:center}
details .hint{margin-top:8px}

/* ============ Pengaturan ============ */
.set-grid{display:grid;gap:0 16px}
@media (min-width:1100px){.set-grid{grid-template-columns:1fr 1fr}}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--faint);font-size:12px;letter-spacing:.05em;text-transform:uppercase}
.kbd{display:inline-block;font:12px var(--mono);padding:1px 7px;border:1px solid var(--line2);border-bottom-width:2px;border-radius:6px;background:var(--surface2);color:var(--text)}
.stor{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line)}
.stor:last-of-type{border-bottom:0}
footer{color:var(--faint);font-size:12.5px;text-align:center;margin-top:24px;line-height:1.6}
noscript .msg{margin:16px}

/* ============ Mobile kecil ============ */
@media (max-width:380px){
  .seg button{font-size:13px;padding:6px}
  .tabbar a{font-size:10.5px}
}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
@media (prefers-contrast: more){
  :root{--line:rgba(148,163,184,.45);--line2:rgba(148,163,184,.7)}
}
`;

export const STYLES = DARK + "\n" + THEME_CSS + BASE;
