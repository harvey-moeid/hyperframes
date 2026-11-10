/**
 * Klien bagian 1: konstanta, util DOM, penyimpanan, toast, dialog konfirmasi, tema, router.
 *
 * Semua bagian klien (client-*.js) digabung jadi SATU skrip di dalam satu IIFE (lihat client.js),
 * jadi fungsi/variabel di sini bisa dipakai bagian lain tanpa import. Tidak ada eval, tidak ada
 * innerHTML: data dari server/localStorage masuk DOM lewat textContent saja.
 *
 * ATURAN: tanpa backtick dan tanpa ${ (String.raw); tulis string dengan tanda kutip tunggal.
 */
export const CORE = String.raw`
/* ===== core ===== */
var NS = 'http://www.w3.org/2000/svg';
var ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var RUN_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/;
var ASSET_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
var QUALS = { draft: 1, standard: 1, high: 1 };
var MAX_HTML_BYTES = 256 * 1024;        // sama dengan batas di Worker
var MAX_ASSET_BYTES = 8 * 1024 * 1024;  // sama dengan batas di Worker
var MAX_WAIT_MS = 35 * 60 * 1000;       // workflow dibatasi 30 menit + antrean
var STATUS_TIMEOUT_MS = 15000;
var POST_TIMEOUT_MS = 25000;
var HIST_MAX = 30, DRAFT_MAX = 8, ASSET_MAX = 100;
var K = { key: 'hf_api_key', hist: 'hf_history', drafts: 'hf_drafts', assets: 'hf_assets', theme: 'hf_theme', prefs: 'hf_prefs', onboard: 'hf_onboard_done' };
var ROUTES = ['dashboard', 'create', 'media', 'renders', 'settings'];
var TITLES = { dashboard: 'Dashboard', create: 'Buat video', media: 'Media', renders: 'Render Center', settings: 'Pengaturan' };
// Templat komposisi 5 detik; disisipkan Worker (salinan compositions/contoh/index.html).
var TEMPLATE = __TEMPLATE_JSON__;

/* ---------- util DOM ---------- */
function $(id) { return document.getElementById(id); }
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function h(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
// Ikon dari sprite inline (<symbol id="i-nama">). Dekoratif, jadi aria-hidden.
function icon(name) {
  var s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'i');
  s.setAttribute('aria-hidden', 'true');
  var u = document.createElementNS(NS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.appendChild(u);
  return s;
}
function button(label, cls, ic, fn) {
  var b = h('button', 'btn' + (cls ? ' ' + cls : ''));
  b.type = 'button';
  if (ic) b.appendChild(icon(ic));
  if (label) b.appendChild(h('span', null, label));
  if (fn) b.addEventListener('click', fn);
  return b;
}
function iconButton(ic, label, cls, fn) {
  // Tombol ikon wajib punya nama aksesibel (aria-label) dan tooltip (title).
  var b = button('', 'icon ' + (cls || ''), ic, fn);
  b.setAttribute('aria-label', label);
  b.title = label;
  return b;
}
function setMsg(box, text, kind) {
  if (!text) { box.hidden = true; box.textContent = ''; return; }
  box.className = 'msg' + (kind ? ' ' + kind : '');
  box.textContent = text;
  box.hidden = false;
}
function debounce(fn, ms) {
  var t = null;
  return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
}

/* ---------- penyimpanan (semua dibungkus try/catch; bisa gagal di mode privat) ---------- */
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
  if (!s) return false;
  try { s.setItem(key, val); return true; } catch (e) { return false; }
}
function sDel(kind, key) {
  var s = store(kind);
  if (!s) return;
  try { s.removeItem(key); } catch (e) { /* abaikan */ }
}
function jGet(kind, key) {
  var raw = sGet(kind, key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function jSet(kind, key, val) { return sSet(kind, key, JSON.stringify(val)); }

/* ---------- format ---------- */
function isNum(n) { return typeof n === 'number' && isFinite(n) && n >= 0; }
function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return new Date(ts).toISOString(); }
}
function fmtBytes(n) {
  if (!isNum(n)) return '-';
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
  try { return new TextEncoder().encode(str).length; } catch (e) { return str.length; }
}

/* ---------- toast ---------- */
function toast(text, kind) {
  var box = $('toasts');
  if (!box) return;
  var t = h('div', 'toast' + (kind ? ' ' + kind : ''), text);
  t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  box.appendChild(t);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(function () {
    t.classList.add('out');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
  }, kind === 'err' ? 6500 : 3200);
}
async function copyText(text, okMsg) {
  var ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; }
  } catch (e) { ok = false; }
  if (!ok) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'clip-fallback';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { ok = false; }
  }
  toast(ok ? (okMsg || 'Disalin') : 'Gagal menyalin', ok ? 'ok' : 'err');
}

/* ---------- dialog konfirmasi (native <dialog>: fokus terkunci + Esc gratis) ---------- */
function confirmBox(title, text, okLabel, danger) {
  return new Promise(function (resolve) {
    var dlg = $('dlg');
    if (!dlg || typeof dlg.showModal !== 'function') { resolve(window.confirm(title + '\n' + text)); return; }
    var ok = $('dlgOk'), cancel = $('dlgCancel');
    $('dlgTitle').textContent = title;
    $('dlgText').textContent = text;
    ok.textContent = okLabel || 'Ya';
    ok.className = 'btn ' + (danger ? 'danger-solid' : 'solid');
    var done = false;
    function finish(v) {
      if (done) return;
      done = true;
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onClose);
      if (dlg.open) dlg.close();
      resolve(v);
    }
    function onOk() { finish(true); }
    function onCancel() { finish(false); }
    function onClose() { finish(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dlg.addEventListener('close', onClose);
    dlg.showModal();
    cancel.focus(); // fokus awal di Batal: aman untuk aksi destruktif
  });
}

/* ---------- kontrol segmen & chip (tombol dengan aria-pressed) ---------- */
function seg(root, onChange) {
  var api = { value: null };
  api.set = function (v, silent) {
    api.value = v;
    qsa('button', root).forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-value') === v ? 'true' : 'false');
    });
    if (!silent && onChange) onChange(v);
  };
  root.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!b || !root.contains(b)) return;
    api.set(b.getAttribute('data-value'));
  });
  var pressed = qsa('button', root).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
  api.value = pressed ? pressed.getAttribute('data-value') : null;
  return api;
}

/* ---------- tema & preferensi ---------- */
function loadTheme() {
  var t = sGet('local', K.theme);
  return (t === 'light' || t === 'dark') ? t : 'auto';
}
function applyTheme(t) {
  var r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  var light = t === 'light' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  var m = $('metaTheme');
  if (m) m.setAttribute('content', light ? '#f3f6fc' : '#080D19');
}
var prefs = { quality: 'standard', composition: 'contoh' };
function loadPrefs() {
  var p = jGet('local', K.prefs);
  if (!p || typeof p !== 'object') return;
  if (QUALS[p.quality]) prefs.quality = p.quality;
  if (typeof p.composition === 'string' && ID_RE.test(p.composition)) prefs.composition = p.composition;
}
function savePrefs() { jSet('local', K.prefs, prefs); }

/* ---------- API key (di memori; sessionStorage hanya bila pengguna memilih "ingat") ---------- */
var apiKey = '';
function setApiKey(v, remember) {
  apiKey = v;
  if (remember && v) sSet('session', K.key, v); else sDel('session', K.key);
  updateKeyBars();
}
function updateKeyBars() {
  ['keyBarC', 'keyBarM'].forEach(function (id) {
    var bar = $(id);
    if (!bar) return;
    var ok = !!apiKey;
    bar.className = 'keybar ' + (ok ? 'ok' : 'warn');
    qs('.kb-t', bar).textContent = ok
      ? 'API key terpasang untuk sesi ini.'
      : 'API key belum diatur. Dibutuhkan untuk merender dan mengunggah aset.';
  });
}

/* ---------- pesan galat dari API ---------- */
function describeError(status, data) {
  var code = data && typeof data.error === 'string' ? data.error : '';
  var gs = data && data.github_status;
  switch (code) {
    case 'unauthorized': return 'API key salah.';
    case 'server_not_configured': return 'Server belum dikonfigurasi (secret API_KEY / GITHUB_TOKEN atau var GITHUB_REPO belum diset).';
    case 'id_already_exists': return 'ID sudah dipakai. Kosongkan ID untuk UUID acak atau pilih ID lain.';
    case 'invalid_id': return 'ID tidak valid (huruf, angka, _ dan - saja, maks 64).';
    case 'invalid_composition': return 'Nama komposisi tidak valid atau kosong (huruf, angka, _ dan -, maks 64).';
    case 'invalid_quality': return 'Kualitas tidak valid.';
    case 'invalid_json': return 'Permintaan tidak valid.';
    case 'body_too_large': return 'Permintaan terlalu besar.';
    case 'invalid_html': return 'Isi komposisi tidak valid atau kosong.';
    case 'html_too_large': return 'Isi komposisi terlalu besar (maks 256 KB).';
    case 'composition_already_exists': return 'Nama komposisi sudah ada di repo dan tidak ditimpa. Kosongkan nama (otomatis) atau pilih nama lain.';
    case 'invalid_filename': return 'Nama file tidak valid (huruf, angka, titik, _ dan -, maks 128, harus diawali huruf/angka).';
    case 'invalid_data':
    case 'invalid_base64': return 'File gagal dibaca. Coba pilih ulang filenya.';
    case 'asset_too_large': return 'File terlalu besar (maks 8 MB).';
    case 'commit_failed': {
      var cb = 'Gagal meng-commit ke repo' + (gs ? ' (GitHub ' + gs + ')' : '') + '.';
      if (gs === 404) return cb + ' Token salah atau tidak punya akses ke repo.';
      if (gs === 403) return cb + ' Izin token Contents belum Read and write.';
      if (gs === 401) return cb + ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
      if (gs === 409) return cb + ' Ada commit lain yang bersamaan, coba lagi.';
      return cb;
    }
    case 'dispatch_failed': {
      var db = 'Gagal memicu GitHub Actions' + (gs ? ' (GitHub ' + gs + ')' : '') + '.';
      var tail = '';
      if (gs === 404) tail = ' Token salah atau tidak punya akses ke repo.';
      else if (gs === 403) tail = ' Izin token Contents belum Read and write.';
      else if (gs === 401) tail = ' GITHUB_TOKEN tidak valid atau kedaluwarsa.';
      var note = (data && data.committed && typeof data.composition === 'string')
        ? ' Komposisi "' + data.composition + '" sudah ter-commit; coba lagi lewat mode komposisi yang sudah ada.' : '';
      return db + tail + note;
    }
    default: return 'Gagal (HTTP ' + status + ').';
  }
}
function describeNet(r) {
  if (r.err === 'timeout') return 'Server tidak merespons (timeout). Coba lagi.';
  if (r.err === 'badkey') return 'API key mengandung karakter yang tidak valid.';
  return 'Tidak bisa menghubungi server. Periksa koneksi.';
}
// POST JSON dengan timeout; tidak pernah melempar. Mengembalikan { status, data, err? }.
async function postJson(url, payload, key) {
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, POST_TIMEOUT_MS);
  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: ctrl.signal
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    return { status: res.status, data: data };
  } catch (e) {
    if (e && e.name === 'AbortError') return { status: 0, data: {}, err: 'timeout' };
    if (e && e.name === 'TypeError' && /header|value/i.test(String(e.message))) return { status: 0, data: {}, err: 'badkey' };
    return { status: 0, data: {}, err: 'network' };
  } finally {
    clearTimeout(to);
  }
}

/* ---------- router (hash): #/dashboard  #/create  #/media  #/renders[/id]  #/settings ---------- */
var lastRoute = '';
var lastArg = '';
function parseRoute() {
  var raw = (location.hash || '').replace(/^#\/?/, '');
  var parts = raw.split('/');
  var name = ROUTES.indexOf(parts[0]) >= 0 ? parts[0] : 'dashboard';
  var arg = parts[1] || '';
  try { arg = decodeURIComponent(arg); } catch (e) { arg = ''; }
  if (arg && !ID_RE.test(arg)) arg = '';
  return { name: name, arg: arg };
}
function go(path) {
  if (location.hash === '#/' + path) onRoute(); else location.hash = '#/' + path;
}
function onRoute() {
  var r = parseRoute();
  ROUTES.forEach(function (v) { var s = $('v-' + v); if (s) s.hidden = (v !== r.name); });
  qsa('[data-route]').forEach(function (a) {
    if (a.getAttribute('data-route') === r.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('mTitle').textContent = TITLES[r.name];
  document.title = TITLES[r.name] + ' \u00b7 HyperFrames Studio';
  var changed = lastRoute !== '' && (lastRoute !== r.name || lastArg !== r.arg);
  if (r.name === 'dashboard') renderDashboard();
  else if (r.name === 'create') renderCreate();
  else if (r.name === 'media') renderMedia();
  else if (r.name === 'renders') renderRenders(r.arg);
  else renderSettings();
  if (changed) {
    window.scrollTo(0, 0);
    try { $('main').focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  }
  lastRoute = r.name;
  lastArg = r.arg;
}
`;
