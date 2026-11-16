/**
 * Klien bagian 2: data lokal (riwayat, draf, aset) + pemantauan render (polling /status/:id).
 *
 * KEPUTUSAN:
 *  - Riwayat render disimpan di localStorage perangkat ini. Kunci 'hf_history' sama dengan versi lama,
 *    field baru bersifat opsional, jadi data lama tetap terbaca.
 *  - Riwayat juga disinkronkan dari server lewat GET /renders (syncRemote): render yang sudah selesai atau
 *    gagal di R2 digabung ke daftar lokal. Data lokal tidak pernah ditimpa; sinkronisasi hanya menambah
 *    item yang belum ada, memperbarui status item yang belum final, dan mengisi field kosong ('-').
 *    Item yang dihapus pengguna (hf_hidden) atau sebelum 'Hapus semua' (hf_cleared) tidak diimpor ulang.
 *    Render yang belum selesai tidak ada di R2, jadi hanya terlihat di perangkat yang memulainya.
 *  - Setiap render berstatus 'pending' dipantau oleh pollernya sendiri (peta jobs), jadi beberapa
 *    render bisa jalan bersamaan dan tetap terpantau saat pindah halaman. Poller dilanjutkan otomatis
 *    saat halaman dibuka ulang (resumePending) selama belum lewat 35 menit.
 *  - Backoff polling sama dengan versi lama: 4 dtk, 8 dtk setelah 2 menit, 15 dtk setelah 10 menit.
 *  - Pembatalan render TIDAK didukung API; "Berhenti memantau" hanya menghentikan polling di klien.
 */
export const DATA = String.raw`
/* ===== data lokal ===== */
K.hidden = 'hf_hidden';    // id yang dihapus pengguna dari riwayat (agar tidak diimpor ulang)
K.cleared = 'hf_cleared';  // waktu terakhir 'Hapus semua' riwayat (ms)
var HIDDEN_MAX = 200;
var SYNC_MIN_MS = 30000;

function loadHist() {
  var arr = jGet('local', K.hist);
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length && out.length < HIST_MAX; i++) {
    var it = arr[i];
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID_RE.test(it.id)) continue;
    var o = {
      id: it.id,
      composition: (typeof it.composition === 'string' && ID_RE.test(it.composition)) ? it.composition : '-',
      quality: QUALS[it.quality] ? it.quality : '-',
      ts: isNum(it.ts) ? it.ts : Date.now(),
      status: (it.status === 'done' || it.status === 'timeout' || it.status === 'failed') ? it.status : 'pending'
    };
    if (isNum(it.size)) o.size = it.size;
    if (isNum(it.doneAt)) o.doneAt = it.doneAt;
    if (it.reason === 'cancelled' || it.reason === 'failed') o.reason = it.reason;
    if (typeof it.run_url === 'string' && RUN_URL_RE.test(it.run_url)) o.run_url = it.run_url;
    if (isNum(it.vw)) o.vw = it.vw;
    if (isNum(it.vh)) o.vh = it.vh;
    if (isNum(it.dur)) o.dur = it.dur;
    out.push(o);
  }
  return out;
}
function saveHist(list) { jSet('local', K.hist, list.slice(0, HIST_MAX)); }
function findHist(id) {
  var list = loadHist();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
// Tambah item baru (paling atas) atau gabungkan field ke item yang sudah ada.
function upsertHist(item) {
  var list = loadHist();
  var found = null;
  list = list.filter(function (x) { if (x.id === item.id) { found = x; return false; } return true; });
  var merged = {};
  var k;
  if (found) for (k in found) merged[k] = found[k];
  for (k in item) merged[k] = item[k];
  list.unshift(merged);
  saveHist(list);
}
function patchHist(id, fields) {
  var list = loadHist();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { for (var k in fields) list[i][k] = fields[k]; }
  }
  saveHist(list);
}
function removeHist(id) { hideId(id); saveHist(loadHist().filter(function (x) { return x.id !== id; })); }
// Hapus semua riwayat lokal dan catat waktunya supaya sinkronisasi tidak mengimpor ulang render lama.
function clearHist() { markCleared(); sDel('local', K.hist); }

function loadDrafts() {
  var arr = jGet('local', K.drafts);
  if (!Array.isArray(arr)) return [];
  return arr.filter(function (d) {
    return d && typeof d.id === 'string' && typeof d.html === 'string' && isNum(d.ts);
  }).slice(0, DRAFT_MAX).map(function (d) {
    return {
      id: d.id.slice(0, 40),
      name: (typeof d.name === 'string' && ID_RE.test(d.name)) ? d.name : '',
      html: d.html,
      quality: QUALS[d.quality] ? d.quality : 'standard',
      ts: d.ts
    };
  });
}
function saveDrafts(list) { return jSet('local', K.drafts, list.slice(0, DRAFT_MAX)); }

function loadAssets() {
  var arr = jGet('local', K.assets);
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length && out.length < ASSET_MAX; i++) {
    var a = arr[i];
    if (!a || typeof a !== 'object') continue;
    if (typeof a.composition !== 'string' || !ID_RE.test(a.composition)) continue;
    if (typeof a.filename !== 'string' || !ASSET_NAME_RE.test(a.filename)) continue;
    out.push({
      id: typeof a.id === 'string' ? a.id.slice(0, 60) : (a.composition + '/' + a.filename),
      composition: a.composition,
      filename: a.filename,
      src: 'assets/' + a.filename,
      bytes: isNum(a.bytes) ? a.bytes : 0,
      cat: (a.cat === 'avatar' || a.cat === 'video' || a.cat === 'image' || a.cat === 'audio') ? a.cat : 'other',
      ts: isNum(a.ts) ? a.ts : Date.now()
    });
  }
  return out;
}
function saveAssets(list) { return jSet('local', K.assets, list.slice(0, ASSET_MAX)); }

/* ===== sinkronisasi riwayat dari server (GET /renders) ===== */
var lastSync = 0;
var syncing = false;

function loadHidden() {
  var arr = jGet('local', K.hidden);
  if (!Array.isArray(arr)) return [];
  return arr.filter(function (x) { return typeof x === 'string' && ID_RE.test(x); }).slice(0, HIDDEN_MAX);
}
function hideId(id) {
  var list = loadHidden().filter(function (x) { return x !== id; });
  list.unshift(id);
  jSet('local', K.hidden, list.slice(0, HIDDEN_MAX));
}
function markCleared() { sSet('local', K.cleared, String(Date.now())); }
function clearedAt() {
  var n = Number(sGet('local', K.cleared));
  return isNum(n) ? n : 0;
}

// Ubah balasan server jadi daftar item tervalidasi (tidak percaya bentuk data dari jaringan).
function parseRemote(d) {
  var out = [];
  if (!d || !Array.isArray(d.renders)) return out;
  d.renders.forEach(function (r) {
    if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id)) return;
    var ts = Date.parse(r.uploaded);
    if (!isFinite(ts)) return;
    var o = {
      id: r.id,
      status: r.status === 'done' ? 'done' : 'failed',
      ts: ts,
      composition: (typeof r.composition === 'string' && ID_RE.test(r.composition)) ? r.composition : '',
      quality: (typeof r.quality === 'string' && Object.prototype.hasOwnProperty.call(QUALS, r.quality)) ? r.quality : ''
    };
    if (isNum(r.size)) o.size = r.size;
    if (r.reason === 'cancelled' || r.reason === 'failed') o.reason = r.reason;
    if (typeof r.run_url === 'string' && RUN_URL_RE.test(r.run_url)) o.run_url = r.run_url;
    out.push(o);
  });
  return out;
}

// Gabungkan item server ke riwayat lokal. Mengembalikan true bila ada yang berubah.
function mergeRemote(items) {
  var list = loadHist();
  var byId = {};
  list.forEach(function (it) { byId[it.id] = it; });
  var hidden = {};
  loadHidden().forEach(function (x) { hidden[x] = 1; });
  var since = clearedAt();
  var changed = false;

  items.forEach(function (r) {
    var cur = byId[r.id];
    if (cur) {
      if (r.status === 'done' && cur.status !== 'done') {
        // Server sudah punya MP4: ini yang menang (sama dengan GET /status/:id).
        cur.status = 'done';
        delete cur.reason;
        if (isNum(r.size)) cur.size = r.size;
        if (!isNum(cur.doneAt)) cur.doneAt = r.ts;
        stopTracking(cur.id);
        changed = true;
      } else if (r.status === 'failed' && (cur.status === 'pending' || cur.status === 'timeout')) {
        cur.status = 'failed';
        cur.reason = r.reason === 'cancelled' ? 'cancelled' : 'failed';
        if (r.run_url) cur.run_url = r.run_url;
        if (!isNum(cur.doneAt)) cur.doneAt = r.ts;
        stopTracking(cur.id);
        changed = true;
      } else if (r.status === 'done' && cur.status === 'done' && !isNum(cur.size) && isNum(r.size)) {
        cur.size = r.size;
        changed = true;
      }
      if (cur.composition === '-' && r.composition) { cur.composition = r.composition; changed = true; }
      if (cur.quality === '-' && r.quality) { cur.quality = r.quality; changed = true; }
      return;
    }
    // Item baru dari server: lewati yang dihapus pengguna atau lebih lama dari 'Hapus semua'.
    if (hidden[r.id] || r.ts <= since) return;
    var o = {
      id: r.id,
      composition: r.composition || '-',
      quality: r.quality || '-',
      ts: r.ts,
      status: r.status
    };
    if (isNum(r.size)) o.size = r.size;
    if (r.reason) o.reason = r.reason;
    if (r.run_url) o.run_url = r.run_url;
    list.push(o);
    byId[o.id] = o;
    changed = true;
  });

  if (!changed) return false;
  list.sort(function (a, b) { return b.ts - a.ts; });
  saveHist(list);
  return true;
}

function onSynced() {
  updateBadges();
  var r = parseRoute();
  if (r.name === 'dashboard') renderDashboard();
  else if (r.name === 'renders') { renderRcList(r.arg); if (r.arg) updateDetail(r.arg); }
  else if (r.name === 'settings') renderSettings();
}

// Ambil daftar render dari server dan gabungkan. Butuh API key; gagal diam-diam (riwayat lokal tetap dipakai).
// force=true melewati jeda minimal antar sinkronisasi.
async function syncRemote(force) {
  if (!apiKey || syncing) return;
  if (!force && Date.now() - lastSync < SYNC_MIN_MS) return;
  syncing = true;
  lastSync = Date.now();
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, STATUS_TIMEOUT_MS);
  try {
    var res = await fetch('/renders?limit=40', { headers: { 'x-api-key': apiKey }, cache: 'no-store', signal: ctrl.signal });
    if (res.status !== 200) return;
    var d = await res.json();
    if (mergeRemote(parseRemote(d))) onSynced();
  } catch (e) {
    /* abaikan: jaringan atau header tidak valid */
  } finally {
    clearTimeout(to);
    syncing = false;
  }
}

/* ===== status & lencana ===== */
var STATUS_LABEL = { pending: 'Diproses', done: 'Selesai', timeout: 'Belum selesai', failed: 'Gagal' };
function statusInfo(it) {
  if (it.status === 'done') return { kind: 'done', label: 'Selesai' };
  if (it.status === 'failed') return { kind: 'bad', label: it.reason === 'cancelled' ? 'Dibatalkan' : 'Gagal' };
  if (it.status === 'timeout') return { kind: 'bad', label: 'Belum selesai' };
  if (jobs[it.id]) return { kind: 'run', label: 'Diproses' };
  return { kind: '', label: 'Dijeda' };
}
function badgeEl(info) {
  var b = h('span', 'badge' + (info.kind ? ' ' + info.kind : ''));
  if (info.kind === 'run') { var sp = h('span', 'spin'); sp.setAttribute('aria-hidden', 'true'); b.appendChild(sp); }
  b.appendChild(document.createTextNode(info.label));
  return b;
}
function setBadge(el, info) {
  el.className = 'badge' + (info.kind ? ' ' + info.kind : '');
  el.textContent = '';
  if (info.kind === 'run') { var sp = h('span', 'spin'); sp.setAttribute('aria-hidden', 'true'); el.appendChild(sp); }
  el.appendChild(document.createTextNode(info.label));
}

/* ===== pemantauan render ===== */
var jobs = {};   // id -> { id, start, fails, timer, note }
var ticker = null;

function runningCount() { return Object.keys(jobs).length; }
function updateBadges() {
  var n = runningCount();
  qsa('.nbadge').forEach(function (b) { b.hidden = n === 0; b.textContent = String(n); b.setAttribute('aria-label', n + ' render berjalan'); });
}
function delayFor(job) {
  var ms = Date.now() - job.start;
  if (ms < 2 * 60 * 1000) return 4000;
  if (ms < 10 * 60 * 1000) return 8000;
  return 15000;
}
function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(function () {
    if (!runningCount()) { clearInterval(ticker); ticker = null; return; }
    if (detailId) updateElapsed();
  }, 1000);
}
function startTracking(id) {
  if (jobs[id]) return;
  var it = findHist(id);
  if (!it || it.status !== 'pending') return;
  var job = { id: id, start: it.ts, fails: 0, timer: null, note: '' };
  jobs[id] = job;
  ensureTicker();
  updateBadges();
  poll(job);
}
function stopTracking(id) {
  var job = jobs[id];
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  delete jobs[id];
  updateBadges();
}

async function poll(job) {
  if (jobs[job.id] !== job) return;
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, STATUS_TIMEOUT_MS);
  var res = null;
  try { res = await fetch('/status/' + job.id, { cache: 'no-store', signal: ctrl.signal }); }
  catch (e) { res = null; }
  clearTimeout(to);
  if (jobs[job.id] !== job) return;

  if (res && res.status === 200) {
    var d = {};
    try { d = await res.json(); } catch (e) { d = {}; }
    if (jobs[job.id] !== job) return;
    onDone(job, d);
    return;
  }
  // 410: workflow menandai render ini gagal atau dibatalkan.
  if (res && res.status === 410) {
    var fd = {};
    try { fd = await res.json(); } catch (e) { fd = {}; }
    if (jobs[job.id] !== job) return;
    onFailed(job, fd);
    return;
  }
  if (res && res.status === 404) {
    job.fails = 0;
    if (job.note) { job.note = ''; if (detailId === job.id) updateDetail(job.id); }
  } else {
    job.fails++;
    job.note = 'Gagal menghubungi server (' + (res ? 'HTTP ' + res.status : 'jaringan') + '). Mencoba lagi\u2026';
    if (detailId === job.id) updateDetail(job.id);
  }
  if (Date.now() - job.start > MAX_WAIT_MS) { onTimeout(job); return; }
  job.timer = setTimeout(function () { poll(job); }, delayFor(job));
}

function onDone(job, d) {
  stopTracking(job.id);
  patchHist(job.id, { status: 'done', size: (d && isNum(d.size)) ? d.size : undefined, doneAt: Date.now() });
  toast('Render selesai: ' + job.id, 'ok');
  onJobChange(job.id);
}
function onFailed(job, d) {
  stopTracking(job.id);
  var cancelled = !!(d && d.reason === 'cancelled');
  var f = { status: 'failed', reason: cancelled ? 'cancelled' : 'failed', doneAt: Date.now() };
  // Tautan hanya dipakai bila cocok bentuk tautan run GitHub (validasi ulang di klien).
  if (d && typeof d.run_url === 'string' && RUN_URL_RE.test(d.run_url)) f.run_url = d.run_url;
  patchHist(job.id, f);
  toast(cancelled ? 'Render dibatalkan: ' + job.id : 'Render gagal: ' + job.id, 'err');
  onJobChange(job.id);
}
function onTimeout(job) {
  stopTracking(job.id);
  patchHist(job.id, { status: 'timeout', doneAt: Date.now() });
  toast('Render belum selesai setelah 35 menit: ' + job.id, 'warn');
  onJobChange(job.id);
}
// Dipanggil saat status sebuah render berubah: segarkan halaman yang sedang tampil.
function onJobChange(id) {
  updateBadges();
  var r = parseRoute();
  if (r.name === 'dashboard') renderDashboard();
  else if (r.name === 'renders') { renderRcList(r.arg); if (r.arg === id) updateDetail(id); }
}
// Lanjutkan pemantauan render yang masih 'pending' saat halaman dibuka ulang.
function resumePending() {
  loadHist().forEach(function (it) {
    if (it.status !== 'pending') return;
    if (Date.now() - it.ts > MAX_WAIT_MS) { patchHist(it.id, { status: 'timeout' }); return; }
    startTracking(it.id);
  });
}

// Kirim render (dipakai form Buat video dan tombol Coba lagi). Mengembalikan { ok, id, composition } atau { ok:false, msg }.
async function submitRender(payload, quality) {
  var r = await postJson('/render', payload, apiKey);
  var data = r.data;
  if (r.status === 202 && data && typeof data.id === 'string' && ID_RE.test(data.id)) {
    // Nama komposisi otomatis (web-ID) hanya diketahui server; pakai balasannya.
    var usedComp = (typeof data.composition === 'string' && ID_RE.test(data.composition)) ? data.composition : (payload.composition || '-');
    upsertHist({ id: data.id, composition: usedComp, quality: quality, ts: Date.now(), status: 'pending' });
    startTracking(data.id);
    updateBadges();
    return { ok: true, id: data.id, composition: usedComp };
  }
  return { ok: false, msg: r.err ? describeNet(r) : describeError(r.status, data) };
}
`;
