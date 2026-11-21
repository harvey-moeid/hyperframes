/**
 * Klien bagian 5: kartu Transkrip di halaman Media (POST /transcribe + pemantauan GET /transcript/:id).
 *
 * KEPUTUSAN:
 *  - Pemantauan meniru render (client-data.js): satu poller per transkrip (peta trJobs), backoff yang sama
 *    lewat delayFor(), batas tunggu MAX_WAIT_MS, dilanjutkan saat halaman dibuka ulang (resumeTranscripts).
 *    Bedanya: /transcript/:id dilindungi x-api-key (berisi isi ucapan), jadi kunci dikirim HANYA lewat
 *    header x-api-key, tidak pernah lewat URL, body, atau log. Tanpa API key pemantauan tidak jalan.
 *  - Hanya metadata pekerjaan yang disimpan di localStorage (kunci hf_transcripts). Isi kata (bisa panjang
 *    dan berisi ucapan orang) hanya ada di memori dan diambil ulang dari server bila perlu.
 *  - Validasi dua lapis: (1) klien memeriksa bentuk id, nama file, bahasa, model sebelum mengirim dan saat
 *    membaca data tersimpan atau balasan server; (2) Worker memeriksa ulang (transcribe.js).
 *  - Data dari server/localStorage masuk DOM lewat textContent saja. Tanpa innerHTML, tanpa style inline.
 *  - Format objek T: satu kunci per kata (slug dari teksnya, duplikat diberi akhiran _2, _3) berisi waktu
 *    mulai dalam detik. Ubah trToT() bila komposisi memakai bentuk lain.
 *
 * ATURAN: tanpa backtick dan tanpa ${ di dalam String.raw; tulis string dengan tanda kutip tunggal.
 * Fungsi/variabel dari client-core/client-data/client-create dipakai langsung (satu IIFE).
 */
export const TRANSCRIBE = String.raw`
/* ===== Transkrip audio ===== */
K.tr = 'hf_transcripts';
var TR_AUDIO_RE = /\.(wav|mp3|m4a|aac|ogg|flac|mp4|webm|mov)$/i;
var TR_LANG_RE = /^[a-z]{2,3}$/;
var TR_WORD_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;
var TR_MODELS = { 'tiny.en': 1, 'base.en': 1, 'small.en': 1, 'medium.en': 1, small: 1, medium: 1, 'large-v3': 1 };
var TR_DEFAULT_LANG = 'id';
var TR_DEFAULT_MODEL = 'small';
var TR_MAX = 20;            // maksimum riwayat transkrip tersimpan
var TR_WORDS_MAX = 20000;   // batas kata yang diterima dari server
var TR_SHOW_MAX = 2000;     // batas baris yang digambar di daftar
var trJobs = {};            // id -> { id, start, fails, timer, note }
var trResults = {};         // id -> hasil terurai (hanya di memori)
var trLoading = {};         // id -> true saat hasil sedang diambil
var trErr = {};             // id -> pesan galat saat memuat hasil
var trPaused = {};          // id -> true bila pengguna menghentikan pemantauan
var trActive = '';
var trTicker = null;

/* ---------- validasi ---------- */
function trHasModel(m) { return typeof m === 'string' && Object.prototype.hasOwnProperty.call(TR_MODELS, m); }
// Mengembalikan teks galat, atau '' bila semua bidang sah (lapis 1; Worker memeriksa lagi).
function trValidInput(composition, filename, language, model) {
  if (typeof composition !== 'string' || !ID_RE.test(composition)) return 'Nama komposisi audio tidak valid.';
  if (typeof filename !== 'string' || !ASSET_NAME_RE.test(filename) || !TR_AUDIO_RE.test(filename)) return 'Nama file audio tidak valid atau formatnya tidak didukung.';
  if (typeof language !== 'string' || !TR_LANG_RE.test(language)) return 'Kode bahasa tidak valid.';
  if (!trHasModel(model)) return 'Model tidak dikenal.';
  return '';
}
function trCleanJob(it) {
  if (!it || typeof it !== 'object') return null;
  if (typeof it.id !== 'string' || !ID_RE.test(it.id)) return null;
  if (trValidInput(it.composition, it.filename, TR_LANG_RE.test(it.language) ? it.language : TR_DEFAULT_LANG, trHasModel(it.model) ? it.model : TR_DEFAULT_MODEL)) return null;
  var o = {
    id: it.id,
    composition: it.composition,
    filename: it.filename,
    language: TR_LANG_RE.test(it.language) ? it.language : TR_DEFAULT_LANG,
    model: trHasModel(it.model) ? it.model : TR_DEFAULT_MODEL,
    ts: isNum(it.ts) ? it.ts : Date.now(),
    status: (it.status === 'done' || it.status === 'failed' || it.status === 'timeout') ? it.status : 'pending'
  };
  if (isNum(it.doneAt)) o.doneAt = it.doneAt;
  if (it.reason === 'cancelled' || it.reason === 'failed') o.reason = it.reason;
  if (typeof it.run_url === 'string' && RUN_URL_RE.test(it.run_url)) o.run_url = it.run_url;
  if (isNum(it.word_count)) o.word_count = it.word_count;
  if (isNum(it.duration)) o.duration = it.duration;
  return o;
}

/* ---------- penyimpanan metadata ---------- */
function trLoad() {
  var arr = jGet('local', K.tr);
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length && out.length < TR_MAX; i++) {
    var v = trCleanJob(arr[i]);
    if (v) out.push(v);
  }
  return out;
}
function trSave(list) { jSet('local', K.tr, list.slice(0, TR_MAX)); }
function trFind(id) {
  var list = trLoad();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function trUpsert(item) {
  var list = trLoad();
  list = list.filter(function (x) { return x.id !== item.id; });
  list.unshift(item);
  trSave(list);
}
function trPatch(id, fields) {
  var list = trLoad();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { for (var k in fields) list[i][k] = fields[k]; }
  }
  trSave(list);
}
function trDelete(id) {
  trSave(trLoad().filter(function (x) { return x.id !== id; }));
  delete trResults[id];
  delete trErr[id];
  delete trPaused[id];
}

/* ---------- hasil: parser, JSON, objek T ---------- */
// Ubah balasan server jadi bentuk tervalidasi (tidak percaya bentuk data dari jaringan).
function trParse(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.words)) return null;
  var words = [];
  for (var i = 0; i < d.words.length && words.length < TR_WORDS_MAX; i++) {
    var w = d.words[i];
    if (!w || typeof w !== 'object' || typeof w.text !== 'string' || !isNum(w.start)) continue;
    var text = w.text.trim().slice(0, 120);
    if (!text) continue;
    words.push({
      id: (typeof w.id === 'string' && TR_WORD_ID_RE.test(w.id)) ? w.id : 'w' + (words.length + 1),
      text: text,
      start: w.start,
      end: (isNum(w.end) && w.end >= w.start) ? w.end : w.start
    });
  }
  return {
    words: words,
    duration: isNum(d.duration) ? d.duration : (words.length ? words[words.length - 1].end : 0),
    language: (typeof d.language === 'string' && TR_LANG_RE.test(d.language)) ? d.language : '',
    model: trHasModel(d.model) ? d.model : ''
  };
}
function trToJson(it, res) {
  return JSON.stringify({
    id: it.id,
    composition: it.composition,
    filename: it.filename,
    language: res.language || it.language,
    model: res.model || it.model,
    duration: res.duration,
    word_count: res.words.length,
    words: res.words
  }, null, 2);
}
// Slug kunci objek: huruf kecil tanpa aksen, selain a-z0-9 jadi _, tidak boleh diawali angka.
function trSlug(text) {
  var s = String(text);
  if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = 'kata';
  if (/^[0-9]/.test(s)) s = 'k' + s;
  return s.slice(0, 32);
}
function trToT(words) {
  var used = {};
  var lines = [];
  for (var i = 0; i < words.length; i++) {
    var base = trSlug(words[i].text);
    var key = base;
    var n = 1;
    while (Object.prototype.hasOwnProperty.call(used, key)) { n++; key = base + '_' + n; }
    used[key] = 1;
    lines.push('  ' + key + ': ' + words[i].start.toFixed(2));
  }
  return 'const T = {\n' + lines.join(',\n') + (lines.length ? ',' : '') + '\n};';
}

/* ---------- status & tampilan ---------- */
function trStatusInfo(it) {
  if (it.status === 'done') return { kind: 'done', label: 'Selesai' };
  if (it.status === 'failed') return { kind: 'bad', label: it.reason === 'cancelled' ? 'Dibatalkan' : 'Gagal' };
  if (it.status === 'timeout') return { kind: 'bad', label: 'Belum selesai' };
  if (trJobs[it.id]) return { kind: 'run', label: 'Diproses' };
  return { kind: '', label: 'Dijeda' };
}
// Daftar audio yang bisa ditranskripsi: aset lokal dengan ekstensi yang diterima server (audio lebih dulu).
function trAudioAssets() {
  var list = loadAssets().filter(function (a) { return TR_AUDIO_RE.test(a.filename); });
  list.sort(function (x, y) { return ((y.cat === 'audio') - (x.cat === 'audio')) || (y.ts - x.ts); });
  return list;
}
// Nilai <option> = komposisi + '/' + file. Komposisi tidak boleh memuat '/', jadi pemisahan aman.
function trPickAsset(value) {
  if (typeof value !== 'string') return null;
  var i = value.indexOf('/');
  if (i < 1) return null;
  var comp = value.slice(0, i), file = value.slice(i + 1);
  var list = trAudioAssets();
  for (var k = 0; k < list.length; k++) if (list[k].composition === comp && list[k].filename === file) return list[k];
  return null;
}
function trFillAudio() {
  var sel = $('trAudio');
  var keep = sel.value;
  var list = trAudioAssets();
  sel.textContent = '';
  if (!list.length) {
    var none = document.createElement('option');
    none.value = '';
    none.textContent = 'Belum ada audio';
    sel.appendChild(none);
  }
  list.forEach(function (a) {
    var o = document.createElement('option');
    o.value = a.composition + '/' + a.filename;
    o.textContent = a.filename + ' \u00b7 ' + a.composition + ' \u00b7 ' + fmtBytes(a.bytes);
    sel.appendChild(o);
  });
  if (keep && trPickAsset(keep)) sel.value = keep;
  $('trAudioHint').textContent = list.length
    ? 'Diambil dari pustaka aset di perangkat ini (audio, atau video bila ingin mentranskripsi suaranya).'
    : 'Belum ada audio. Unggah dulu lewat Unggah aset di atas (kategori Audio).';
}
function trRenderList() {
  var list = trLoad();
  var ul = $('trList');
  ul.textContent = '';
  $('trEmpty').hidden = list.length > 0;
  list.forEach(function (it) {
    var li = h('li', 'row st-' + it.status + (it.id === trActive ? ' active' : ''));
    var pick = h('button', 'row-a tr-pick');
    pick.type = 'button';
    if (it.id === trActive) pick.setAttribute('aria-current', 'true');
    var dot = h('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    var info = h('div', 'h-info');
    info.appendChild(h('b', null, it.filename));
    info.appendChild(h('span', 'h-meta', it.composition + ' \u00b7 ' + it.language + ' \u00b7 ' + it.model + ' \u00b7 ' + fmtTime(it.ts)));
    pick.appendChild(dot);
    pick.appendChild(info);
    pick.addEventListener('click', function () { trShow(it.id); });
    li.appendChild(pick);
    li.appendChild(badgeEl(trStatusInfo(it)));
    ul.appendChild(li);
  });
}
function trRenderWords(id, res) {
  var ol = $('trWords');
  if (ol.getAttribute('data-id') === id && ol.getAttribute('data-n') === String(res.words.length)) return;
  ol.textContent = '';
  var n = Math.min(res.words.length, TR_SHOW_MAX);
  var frag = document.createDocumentFragment();
  for (var i = 0; i < n; i++) {
    var li = h('li', 'tr-word');
    li.appendChild(h('span', 'tr-t', res.words[i].start.toFixed(2) + ' s'));
    li.appendChild(h('span', 'tr-w', res.words[i].text));
    frag.appendChild(li);
  }
  ol.appendChild(frag);
  ol.setAttribute('data-id', id);
  ol.setAttribute('data-n', String(res.words.length));
  var note = $('trWordsNote');
  note.hidden = res.words.length <= TR_SHOW_MAX;
  if (!note.hidden) note.textContent = 'Menampilkan ' + TR_SHOW_MAX + ' kata pertama dari ' + res.words.length + '. Salinan JSON dan objek T berisi semua kata.';
}
function trUpdateElapsed() {
  if (!trActive) return;
  var it = trFind(trActive);
  if (!it) return;
  var el = $('trElapsed');
  if (it.status === 'pending') el.textContent = (trJobs[it.id] ? 'Berjalan ' : 'Dijeda \u00b7 berjalan ') + fmtDur(Date.now() - it.ts);
  else if (isNum(it.doneAt) && it.doneAt >= it.ts) el.textContent = 'Total waktu ' + fmtDur(it.doneAt - it.ts);
  else el.textContent = '';
}
function trEnsureTicker() {
  if (trTicker) return;
  trTicker = setInterval(function () {
    if (!Object.keys(trJobs).length) { clearInterval(trTicker); trTicker = null; return; }
    trUpdateElapsed();
  }, 1000);
}
// Tampilkan detail satu transkrip (diperbarui di tempat; daftar kata hanya digambar ulang bila berubah).
function trShow(id) {
  var it = id ? trFind(id) : null;
  var box = $('trDetail');
  if (!it) { trActive = ''; box.hidden = true; trRenderList(); return; }
  trActive = id;
  box.hidden = false;
  var job = trJobs[id];
  var running = it.status === 'pending' && !!job;
  var res = trResults[id] || null;
  $('trId').textContent = id;
  setBadge($('trBadge'), trStatusInfo(it));
  $('trProg').hidden = !running;
  $('trKAudio').textContent = it.filename;
  $('trKLang').textContent = it.language;
  $('trKModel').textContent = it.model;
  $('trKWords').textContent = res ? String(res.words.length) : (isNum(it.word_count) ? String(it.word_count) : '-');
  $('trKDur').textContent = res ? fmtDur(res.duration * 1000) : (isNum(it.duration) ? fmtDur(it.duration * 1000) : '-');
  $('trKStart').textContent = fmtTime(it.ts);

  var logBtn = $('trLog');
  var okRun = typeof it.run_url === 'string' && RUN_URL_RE.test(it.run_url);
  logBtn.hidden = !okRun;
  if (okRun) logBtn.href = it.run_url;
  $('trRetry').hidden = !(it.status === 'failed' || it.status === 'timeout');
  $('trStop').hidden = !running;
  $('trResume').hidden = !(it.status === 'pending' && !job);

  var note = '', kind = '';
  if (it.status === 'pending') {
    if (!job && !apiKey) { note = 'Isi API key di Pengaturan agar status bisa dipantau.'; kind = 'warn'; }
    else if (!job) { note = 'Pemantauan dihentikan. Transkripsi di GitHub tetap berjalan; klik Lanjut memantau untuk memeriksa lagi.'; }
    else if (job.note) { note = job.note; kind = 'warn'; }
  } else if (it.status === 'failed') {
    note = it.reason === 'cancelled'
      ? 'Transkripsi dibatalkan di GitHub Actions. Jalankan lagi dengan tombol Coba lagi bila perlu.'
      : 'Transkripsi gagal di GitHub Actions. Buka log untuk melihat sebabnya, lalu coba lagi.';
    kind = 'err';
  } else if (it.status === 'timeout') {
    note = 'Belum selesai setelah 35 menit dan tidak ada penanda gagal. Cek log workflow Transcribe audio di tab Actions GitHub.';
    kind = 'err';
  } else if (it.status === 'done' && !res && trErr[id]) {
    note = trErr[id];
    kind = 'err';
  }
  setMsg($('trNote'), note, kind);

  var done = it.status === 'done';
  if (done && !res && !trErr[id]) trFetchResult(id);
  $('trReload').hidden = !(done && !res && !trLoading[id]);
  $('trResult').hidden = !(done && res);
  if (done && res) trRenderWords(id, res);
  trRenderList();
  trUpdateElapsed();
}
// Dipanggil saat status berubah: segarkan daftar dan detail bila sedang dibuka.
function trChanged(id) {
  if (!$('trCard')) return;
  if (trActive === id) trShow(id); else trRenderList();
}

/* ---------- pemantauan (poll GET /transcript/:id, kunci hanya lewat header) ---------- */
function trStart(id) {
  if (trJobs[id] || !apiKey) return;
  var it = trFind(id);
  if (!it || it.status !== 'pending') return;
  var job = { id: id, start: it.ts, fails: 0, timer: null, note: '' };
  trJobs[id] = job;
  trEnsureTicker();
  trPoll(job);
}
function trStopJob(id) {
  var job = trJobs[id];
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  delete trJobs[id];
}
async function trPoll(job) {
  if (trJobs[job.id] !== job) return;
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, STATUS_TIMEOUT_MS);
  var res = null;
  try { res = await fetch('/transcript/' + job.id, { headers: { 'x-api-key': apiKey }, cache: 'no-store', signal: ctrl.signal }); }
  catch (e) { res = null; }
  clearTimeout(to);
  if (trJobs[job.id] !== job) return;

  if (res && res.status === 200) {
    var d = null;
    try { d = await res.json(); } catch (e) { d = null; }
    if (trJobs[job.id] !== job) return;
    var parsed = trParse(d);
    if (parsed) { trOnDone(job, parsed); return; }
    job.fails++;
    job.note = 'Respons transkrip tidak dikenali. Mencoba lagi\u2026';
  } else if (res && res.status === 410) {
    var fd = {};
    try { fd = await res.json(); } catch (e) { fd = {}; }
    if (trJobs[job.id] !== job) return;
    trOnFailed(job, fd);
    return;
  } else if (res && res.status === 401) {
    // API key salah: berhenti memantau, status tetap 'pending' supaya bisa dilanjutkan setelah key benar.
    trStopJob(job.id);
    trPaused[job.id] = true;
    toast('API key salah. Pemantauan transkrip dihentikan.', 'err');
    trChanged(job.id);
    return;
  } else if (res && res.status === 404) {
    job.fails = 0;
    job.note = '';
  } else {
    job.fails++;
    job.note = 'Gagal menghubungi server (' + (res ? 'HTTP ' + res.status : 'jaringan') + '). Mencoba lagi\u2026';
  }
  if (trActive === job.id) trShow(job.id);
  if (Date.now() - job.start > MAX_WAIT_MS) { trOnTimeout(job); return; }
  job.timer = setTimeout(function () { trPoll(job); }, delayFor(job));
}
function trOnDone(job, parsed) {
  trStopJob(job.id);
  trResults[job.id] = parsed;
  delete trErr[job.id];
  trPatch(job.id, { status: 'done', doneAt: Date.now(), word_count: parsed.words.length, duration: parsed.duration });
  toast('Transkrip selesai: ' + job.id, 'ok');
  trChanged(job.id);
}
function trOnFailed(job, d) {
  trStopJob(job.id);
  var cancelled = !!(d && d.reason === 'cancelled');
  var f = { status: 'failed', reason: cancelled ? 'cancelled' : 'failed', doneAt: Date.now() };
  // Tautan hanya dipakai bila cocok bentuk tautan run GitHub (validasi ulang di klien).
  if (d && typeof d.run_url === 'string' && RUN_URL_RE.test(d.run_url)) f.run_url = d.run_url;
  trPatch(job.id, f);
  toast(cancelled ? 'Transkrip dibatalkan: ' + job.id : 'Transkrip gagal: ' + job.id, 'err');
  trChanged(job.id);
}
function trOnTimeout(job) {
  trStopJob(job.id);
  trPatch(job.id, { status: 'timeout', doneAt: Date.now() });
  toast('Transkrip belum selesai setelah 35 menit: ' + job.id, 'warn');
  trChanged(job.id);
}
// Ambil isi hasil untuk transkrip yang sudah selesai (mis. setelah halaman dibuka ulang).
async function trFetchResult(id) {
  if (trLoading[id]) return;
  if (!apiKey) { trErr[id] = 'Isi API key di Pengaturan untuk memuat hasil transkrip.'; return; }
  trLoading[id] = true;
  delete trErr[id];
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, STATUS_TIMEOUT_MS);
  var res = null;
  try { res = await fetch('/transcript/' + id, { headers: { 'x-api-key': apiKey }, cache: 'no-store', signal: ctrl.signal }); }
  catch (e) { res = null; }
  clearTimeout(to);
  var d = null;
  if (res && (res.status === 200 || res.status === 410)) { try { d = await res.json(); } catch (e) { d = null; } }
  delete trLoading[id];
  if (res && res.status === 200) {
    var p = trParse(d);
    if (p) { trResults[id] = p; trPatch(id, { word_count: p.words.length, duration: p.duration }); }
    else trErr[id] = 'Isi transkrip tidak dikenali.';
  } else if (res && res.status === 410) {
    var f = { status: 'failed', reason: (d && d.reason === 'cancelled') ? 'cancelled' : 'failed' };
    if (d && typeof d.run_url === 'string' && RUN_URL_RE.test(d.run_url)) f.run_url = d.run_url;
    trPatch(id, f);
  } else if (res && res.status === 401) {
    trErr[id] = 'API key salah.';
  } else if (res && res.status === 404) {
    trErr[id] = 'Hasil tidak ditemukan di server.';
  } else {
    trErr[id] = 'Gagal memuat hasil (' + (res ? 'HTTP ' + res.status : 'jaringan') + ').';
  }
  trChanged(id);
}
function resumeTranscripts() {
  trLoad().forEach(function (it) {
    if (it.status !== 'pending') return;
    if (Date.now() - it.ts > MAX_WAIT_MS) { trPatch(it.id, { status: 'timeout', doneAt: Date.now() }); return; }
    trStart(it.id);
  });
}

/* ---------- kirim ---------- */
function trDescribeError(status, data) {
  var code = data && typeof data.error === 'string' ? data.error : '';
  if (code === 'invalid_language') return 'Kode bahasa tidak valid (dua atau tiga huruf, mis. id).';
  if (code === 'invalid_model') return 'Model tidak dikenal oleh server.';
  if (code === 'invalid_sha') return 'Versi aset (sha) tidak valid.';
  return describeError(status, data);
}
// Kirim POST /transcribe. Mengembalikan { ok, id } atau { ok:false, msg }.
async function trSend(a, language, model) {
  var bad = trValidInput(a.composition, a.filename, language, model);
  if (bad) return { ok: false, msg: bad };
  var r = await postJson('/transcribe', { composition: a.composition, filename: a.filename, language: language, model: model }, apiKey);
  var data = r.data;
  if (r.status === 202 && data && typeof data.id === 'string' && ID_RE.test(data.id)) {
    trUpsert({ id: data.id, composition: a.composition, filename: a.filename, language: language, model: model, ts: Date.now(), status: 'pending' });
    delete trErr[data.id];
    delete trPaused[data.id];
    trStart(data.id);
    return { ok: true, id: data.id };
  }
  return { ok: false, msg: r.err ? describeNet(r) : trDescribeError(r.status, data) };
}
async function trSubmit() {
  var msg = $('trMsg');
  setMsg(msg, '');
  var a = trPickAsset($('trAudio').value);
  var language = $('trLang').value;
  var model = $('trModel').value;
  if (!a) { setMsg(msg, 'Pilih audio dulu. Bila daftarnya kosong, unggah audio lewat Unggah aset di atas.', 'err'); return; }
  var bad = trValidInput(a.composition, a.filename, language, model);
  if (bad) { setMsg(msg, bad, 'err'); return; }
  if (!apiKey) { setMsg(msg, 'API key belum diatur. Buka Pengaturan untuk mengisinya.', 'err'); return; }
  if (model.slice(-3) === '.en' && language !== 'en') {
    var ok = await confirmBox('Model khusus Inggris', 'Model ' + model + ' akan menerjemahkan ucapan ke bahasa Inggris, bukan menuliskan bahasa aslinya. Lanjutkan?', 'Lanjutkan');
    if (!ok) return;
  }
  var btn = $('trGo');
  btn.disabled = true;
  var r = await trSend(a, language, model);
  btn.disabled = false;
  if (r.ok) {
    toast('Transkripsi dimulai: ' + r.id, 'ok');
    trShow(r.id);
  } else {
    setMsg(msg, r.msg, 'err');
  }
}
async function trRetry(id) {
  var it = trFind(id);
  if (!it) return;
  if (!apiKey) { toast('Isi API key di Pengaturan dulu.', 'err'); go('settings'); return; }
  var b = $('trRetry');
  b.disabled = true;
  var r = await trSend({ composition: it.composition, filename: it.filename }, it.language, it.model);
  b.disabled = false;
  if (r.ok) { toast('Transkripsi ulang dimulai: ' + r.id, 'ok'); trShow(r.id); }
  else toast(r.msg, 'err');
}

/* ---------- siklus hidup ---------- */
function renderTranscribe() {
  if (!$('trCard')) return;
  trFillAudio();
  if (trActive && !trFind(trActive)) trActive = '';
  if (trActive) trShow(trActive); else trRenderList();
}
function initTranscribe() {
  if (!$('trCard')) return;
  $('trLang').value = TR_DEFAULT_LANG;
  $('trModel').value = TR_DEFAULT_MODEL;
  $('trGo').addEventListener('click', trSubmit);
  $('trRetry').addEventListener('click', function () { if (trActive) trRetry(trActive); });
  $('trReload').addEventListener('click', function () { if (!trActive) return; delete trErr[trActive]; trFetchResult(trActive); trShow(trActive); });
  $('trStop').addEventListener('click', function () {
    if (!trActive) return;
    trPaused[trActive] = true;
    trStopJob(trActive);
    trShow(trActive);
    toast('Pemantauan dihentikan. Transkripsi di GitHub tetap berjalan.', 'warn');
  });
  $('trResume').addEventListener('click', function () {
    if (!trActive) return;
    if (!apiKey) { toast('Isi API key di Pengaturan dulu.', 'err'); go('settings'); return; }
    delete trPaused[trActive];
    trStart(trActive);
    trShow(trActive);
  });
  $('trRemove').addEventListener('click', async function () {
    if (!trActive) return;
    var id = trActive;
    var ok = await confirmBox('Hapus dari riwayat?', 'Transkrip ' + id + ' dihapus dari daftar di perangkat ini. Hasil di server tidak ikut terhapus.', 'Hapus', true);
    if (!ok) return;
    trStopJob(id);
    trDelete(id);
    trActive = '';
    toast('Dihapus dari riwayat.', 'ok');
    trShow('');
  });
  $('trCopyT').addEventListener('click', function () {
    var r = trActive ? trResults[trActive] : null;
    if (r) copyText(trToT(r.words), 'Objek T disalin');
  });
  $('trCopyJson').addEventListener('click', function () {
    var it = trActive ? trFind(trActive) : null;
    var r = trActive ? trResults[trActive] : null;
    if (it && r) copyText(trToJson(it, r), 'JSON transkrip disalin');
  });
}
`;
