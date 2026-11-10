/**
 * Klien bagian 3: Dashboard dan Render Center.
 *
 * KEPUTUSAN:
 *  - Detail render di-UPDATE di tempat (updateDetail), bukan dibangun ulang, supaya elemen <video>
 *    tidak dimuat ulang tiap polling. Daftar (rList) dan kartu dashboard boleh dibangun ulang karena
 *    hanya dipanggil saat status benar-benar berubah atau saat halaman dibuka.
 *  - Thumbnail dashboard = frame pertama MP4 itu sendiri (<video preload=metadata>), dimuat malas lewat
 *    IntersectionObserver. Tidak ada endpoint thumbnail di API, jadi tidak ada gambar palsu.
 *  - Resolusi dan durasi dibaca dari metadata video yang benar-benar dimuat; FPS tidak tersedia dari
 *    API/browser sehingga tidak ditampilkan.
 */
export const VIEWS = String.raw`
/* ===== Dashboard ===== */
var detailId = '';
var paused = {};          // id -> true bila pengguna menekan "Berhenti memantau"
var thumbObs = null;
var dFilterSeg = null, rFilterSeg = null;

function filterHist(list, f, q) {
  return list.filter(function (it) {
    if (f === 'pending' && it.status !== 'pending') return false;
    if (f === 'done' && it.status !== 'done') return false;
    if (f === 'bad' && it.status !== 'failed' && it.status !== 'timeout') return false;
    if (q && (it.id + ' ' + it.composition).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function resetThumbs() {
  if (thumbObs) { try { thumbObs.disconnect(); } catch (e) { /* abaikan */ } thumbObs = null; }
}
function lazyThumb(th, id) {
  var v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'none';
  v.tabIndex = -1;
  v.className = 'thumb-v';
  v.setAttribute('aria-hidden', 'true');
  v.addEventListener('loadeddata', function () { th.classList.remove('loading'); th.classList.add('ready'); });
  v.addEventListener('error', function () { th.classList.remove('loading'); });
  th.appendChild(v);
  if (!('IntersectionObserver' in window)) { th.classList.remove('loading'); return; }
  if (!thumbObs) {
    thumbObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var t = e.target;
        thumbObs.unobserve(t);
        var vv = t.querySelector('video');
        if (vv && !vv.getAttribute('src')) { vv.preload = 'metadata'; vv.src = '/video/' + t.getAttribute('data-id') + '#t=0.5'; }
      });
    }, { rootMargin: '160px' });
  }
  th.setAttribute('data-id', id);
  thumbObs.observe(th);
}

function projectCard(it) {
  var a = h('a', 'pcard');
  a.href = '#/renders/' + it.id;
  a.setAttribute('aria-label', 'Buka render ' + it.composition + ' (' + statusInfo(it).label + ')');
  var th = h('div', 'thumb' + (it.status === 'done' ? ' loading' : ''));
  th.appendChild(icon(it.status === 'done' ? 'play' : (it.status === 'pending' ? 'film' : 'alert')));
  if (it.status === 'done') lazyThumb(th, it.id);
  th.appendChild(badgeEl(statusInfo(it)));
  var body = h('div', 'pbody');
  body.appendChild(h('b', 'pname', it.composition));
  body.appendChild(h('code', 'pid', it.id));
  body.appendChild(h('span', 'pmeta', it.quality + ' \u00b7 ' + fmtTime(it.ts)));
  a.appendChild(th);
  a.appendChild(body);
  return a;
}

function renderDraftList(ul, emptyEl) {
  var drafts = loadDrafts();
  ul.textContent = '';
  emptyEl.hidden = drafts.length > 0;
  drafts.forEach(function (d) {
    var li = h('li', 'row');
    var info = h('div', 'h-info');
    info.appendChild(h('b', null, d.name || '(tanpa nama)'));
    info.appendChild(h('span', 'h-meta', fmtBytes(byteLen(d.html)) + ' \u00b7 ' + d.quality + ' \u00b7 ' + fmtTime(d.ts)));
    var acts = h('div', 'row-acts');
    acts.appendChild(button('Lanjutkan', 'sm', null, function () { useDraft(d.id); }));
    acts.appendChild(iconButton('trash', 'Hapus draf ' + (d.name || ''), 'sm danger', function () { deleteDraft(d.id); }));
    li.appendChild(info);
    li.appendChild(acts);
    ul.appendChild(li);
  });
}
function renderDraftLists() {
  renderDraftList($('dDrafts'), $('dDraftsEmpty'));
  renderDraftList($('cDrafts'), $('cDraftsEmpty'));
}

function renderDashboard() {
  var all = loadHist();
  var nDone = 0, nRun = 0, nFail = 0;
  all.forEach(function (it) {
    if (it.status === 'done') nDone++;
    else if (it.status === 'pending') nRun++;
    else nFail++;
  });
  $('sTotal').textContent = String(all.length);
  $('sDone').textContent = String(nDone);
  $('sRun').textContent = String(nRun);
  $('sFail').textContent = String(nFail);

  // Panduan awal: tampil sampai ditutup; langkah ditandai selesai dari keadaan nyata.
  var ob = $('onboard');
  ob.hidden = !!sGet('local', K.onboard);
  if (!ob.hidden) {
    var flags = { key: !!apiKey, comp: all.length > 0 || loadDrafts().length > 0, render: nDone > 0 };
    qsa('li', ob).forEach(function (li) { li.classList.toggle('done', !!flags[li.getAttribute('data-step')]); });
  }

  var q = $('dSearch').value.trim().toLowerCase();
  var list = filterHist(all, dFilterSeg.value, q);
  resetThumbs();
  var grid = $('dGrid');
  grid.textContent = '';
  list.forEach(function (it) { grid.appendChild(projectCard(it)); });
  var empty = $('dEmpty');
  empty.hidden = list.length > 0;
  if (!empty.hidden) {
    var none = all.length === 0;
    $('dEmptyTitle').textContent = none ? 'Belum ada proyek' : 'Tidak ada hasil';
    $('dEmptyText').textContent = none ? 'Mulai dengan komposisi contoh, atau tulis komposisi HTML sendiri.' : 'Ubah kata kunci atau filter status.';
    $('dEmptyCta').hidden = !none;
  }
  renderDraftLists();
}

/* ===== Render Center ===== */
function rcRow(it, activeId) {
  var li = h('li', 'row st-' + it.status + (it.id === activeId ? ' active' : ''));
  var a = h('a', 'row-a');
  a.href = '#/renders/' + it.id;
  if (it.id === activeId) a.setAttribute('aria-current', 'true');
  var dot = h('span', 'dot');
  dot.setAttribute('aria-hidden', 'true');
  var info = h('div', 'h-info');
  info.appendChild(h('code', null, it.id));
  info.appendChild(h('span', 'h-meta', it.composition + ' \u00b7 ' + it.quality + ' \u00b7 ' + fmtTime(it.ts)));
  a.appendChild(dot);
  a.appendChild(info);
  li.appendChild(a);
  li.appendChild(badgeEl(statusInfo(it)));
  return li;
}
function renderRcList(activeId) {
  var all = loadHist();
  var q = $('rSearch').value.trim().toLowerCase();
  var list = filterHist(all, rFilterSeg.value, q);
  var ul = $('rList');
  ul.textContent = '';
  list.forEach(function (it) { ul.appendChild(rcRow(it, activeId)); });
  var empty = $('rEmpty');
  empty.hidden = list.length > 0;
  if (!empty.hidden) {
    var none = all.length === 0;
    $('rEmptyTitle').textContent = none ? 'Belum ada render' : 'Tidak ada hasil';
    $('rEmptyText').textContent = none ? 'Render yang Anda mulai akan muncul di sini beserta statusnya.' : 'Ubah kata kunci atau filter status.';
  }
  $('rClear').hidden = all.length === 0;
}
function renderRenders(arg) {
  $('rc').classList.toggle('has-detail', !!arg);
  renderRcList(arg);
  showDetail(arg);
}

function resetDetailVideo() {
  var v = $('rdVideo');
  try { v.pause(); } catch (e) { /* abaikan */ }
  v.removeAttribute('src');
  v.removeAttribute('data-id');
  try { v.load(); } catch (e) { /* abaikan */ }
}
function showDetail(id) {
  detailId = id || '';
  $('rd').hidden = !id;
  $('rdEmpty').hidden = !!id;
  if (!id) { resetDetailVideo(); return; }
  // Tautan langsung ke ID yang belum ada di riwayat (mis. /?id=...) ikut dicatat.
  if (!findHist(id)) upsertHist({ id: id, composition: '-', quality: '-', ts: Date.now(), status: 'pending' });
  var it = findHist(id);
  if (it && it.status === 'pending' && !jobs[id] && !paused[id]) startTracking(id);
  updateDetail(id);
}

var LONG_NOTE = 'Sudah lebih dari 10 menit. Render panjang memang lama; bila terlalu lama, cek log workflow di tab Actions GitHub.';
function updateElapsed() {
  if (!detailId) return;
  var it = findHist(detailId);
  if (!it) return;
  var el = $('rdElapsed');
  if (it.status === 'pending') {
    var ms = Date.now() - it.ts;
    var job = jobs[it.id];
    el.textContent = (job ? 'Berjalan ' : 'Dijeda \u00b7 berjalan ') + fmtDur(ms);
    if (job && !job.long && ms > 10 * 60 * 1000) { job.long = true; updateDetail(it.id); }
  } else if (isNum(it.doneAt) && it.doneAt >= it.ts) {
    el.textContent = 'Total waktu ' + fmtDur(it.doneAt - it.ts);
  } else {
    el.textContent = '';
  }
}
function updateDetail(id) {
  if (detailId !== id) return;
  var it = findHist(id);
  if (!it) return;
  var job = jobs[id];
  var running = it.status === 'pending' && !!job;
  $('rdId').textContent = id;
  setBadge($('rdBadge'), statusInfo(it));
  $('rdProg').hidden = !running;
  $('rdComp').textContent = it.composition;
  $('rdQual').textContent = it.quality;
  $('rdSize').textContent = isNum(it.size) ? fmtBytes(it.size) : '-';
  $('rdRes').textContent = (it.vw && it.vh) ? (it.vw + ' \u00d7 ' + it.vh) : '-';
  $('rdDur').textContent = isNum(it.dur) ? fmtDur(it.dur * 1000) : '-';
  $('rdStart').textContent = fmtTime(it.ts);

  var v = $('rdVideo');
  var done = it.status === 'done';
  if (done) {
    if (v.getAttribute('data-id') !== id) {
      resetDetailVideo();
      v.setAttribute('data-id', id);
      v.src = '/video/' + id;
      try { v.load(); } catch (e) { /* abaikan */ }
    }
    $('rdDl').href = '/video/' + id;
    $('rdDl').setAttribute('download', id + '.mp4');
  } else {
    resetDetailVideo();
    $('rdPhText').textContent = it.status === 'pending' ? 'Menunggu hasil render\u2026' : 'Render ini tidak menghasilkan video';
  }
  v.hidden = !done;
  $('rdPh').hidden = done;

  $('rdDl').hidden = !done;
  $('rdCopyVideo').hidden = !done;
  $('rdCopyPage').hidden = !done;
  var logBtn = $('rdLog');
  logBtn.hidden = !it.run_url;
  if (it.run_url) logBtn.href = it.run_url;
  $('rdRetry').hidden = !(it.status === 'failed' || it.status === 'timeout');
  $('rdStop').hidden = !running;
  $('rdResume').hidden = !(it.status === 'pending' && !job);
  $('rdHint').hidden = it.status !== 'pending';

  var note = '', kind = '';
  if (it.status === 'pending') {
    if (!job) { note = 'Pemantauan dihentikan. Render di GitHub tetap berjalan; klik "Lanjut memantau" untuk memeriksa lagi.'; }
    else if (job.note) { note = job.note; kind = 'warn'; }
    else if (job.long) { note = LONG_NOTE; kind = 'warn'; }
  } else if (it.status === 'failed') {
    note = it.reason === 'cancelled'
      ? 'Render dibatalkan di GitHub Actions. Jalankan lagi dengan tombol Coba lagi bila perlu.'
      : 'Render gagal di GitHub Actions. Buka log untuk melihat sebabnya, perbaiki komposisinya, lalu coba lagi.';
    kind = 'err';
  } else if (it.status === 'timeout') {
    note = 'Belum selesai setelah 35 menit dan tidak ada penanda gagal. Kemungkinan runner berhenti mendadak atau secret R2 belum diset: cek log workflow "Render video" di tab Actions GitHub.';
    kind = 'err';
  }
  setMsg($('rdNote'), note, kind);
  updateElapsed();
}

async function retryRender(id) {
  var it = findHist(id);
  if (!it) return;
  if (!apiKey) { toast('Isi API key di Pengaturan dulu.', 'err'); go('settings'); return; }
  if (!ID_RE.test(it.composition)) { toast('Nama komposisi tidak diketahui; buat render baru dari halaman Buat video.', 'err'); return; }
  var b = $('rdRetry');
  b.disabled = true;
  var q = QUALS[it.quality] ? it.quality : 'standard';
  // Komposisi dari mode "Tulis baru" sudah ter-commit di repo, jadi cukup dirender ulang tanpa html.
  var r = await submitRender({ composition: it.composition, quality: q }, q);
  b.disabled = false;
  if (r.ok) { toast('Render ulang dimulai: ' + r.id, 'ok'); go('renders/' + r.id); }
  else toast(r.msg, 'err');
}

function manualTrack() {
  var inp = $('manualId');
  var id = inp.value.trim();
  if (!ID_RE.test(id)) { toast('ID tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); inp.focus(); return; }
  inp.value = '';
  go('renders/' + id);
}

function initViews() {
  dFilterSeg = seg($('dFilter'), renderDashboard);
  rFilterSeg = seg($('rFilter'), function () { renderRcList(detailId); });
  $('dSearch').addEventListener('input', debounce(renderDashboard, 150));
  $('rSearch').addEventListener('input', debounce(function () { renderRcList(detailId); }, 150));
  $('onboardClose').addEventListener('click', function () { sSet('local', K.onboard, '1'); $('onboard').hidden = true; });
  $('qaMonitor').addEventListener('click', function () {
    go('renders');
    var d = qs('#v-renders details');
    if (d) d.open = true;
    setTimeout(function () { $('manualId').focus(); }, 60);
  });
  $('manualGo').addEventListener('click', manualTrack);
  $('manualId').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); manualTrack(); } });

  $('rdCopyVideo').addEventListener('click', function () { if (detailId) copyText(location.origin + '/video/' + detailId, 'URL video disalin'); });
  $('rdCopyPage').addEventListener('click', function () { if (detailId) copyText(location.origin + '/?id=' + detailId, 'Tautan halaman disalin'); });
  $('rdRetry').addEventListener('click', function () { if (detailId) retryRender(detailId); });
  $('rdStop').addEventListener('click', function () {
    if (!detailId) return;
    paused[detailId] = true;
    stopTracking(detailId);
    renderRcList(detailId);
    updateDetail(detailId);
    toast('Pemantauan dihentikan. Render di GitHub tetap berjalan.', 'warn');
  });
  $('rdResume').addEventListener('click', function () {
    if (!detailId) return;
    delete paused[detailId];
    startTracking(detailId);
    renderRcList(detailId);
    updateDetail(detailId);
  });
  $('rdRemove').addEventListener('click', async function () {
    if (!detailId) return;
    var id = detailId;
    var ok = await confirmBox('Hapus dari riwayat?', 'Render ' + id + ' dihapus dari daftar di perangkat ini. Video di server tidak ikut terhapus.', 'Hapus', true);
    if (!ok) return;
    stopTracking(id);
    removeHist(id);
    toast('Dihapus dari riwayat.', 'ok');
    go('renders');
  });
  $('rClear').addEventListener('click', async function () {
    var ok = await confirmBox('Hapus semua riwayat?', 'Seluruh riwayat render di perangkat ini dihapus. Video di server tidak ikut terhapus.', 'Hapus semua', true);
    if (!ok) return;
    Object.keys(jobs).forEach(stopTracking);
    sDel('local', K.hist);
    toast('Riwayat dihapus.', 'ok');
    go('renders');
  });

  // Resolusi & durasi dibaca dari metadata video yang benar-benar dimuat.
  $('rdVideo').addEventListener('loadedmetadata', function () {
    var v = $('rdVideo');
    var id = v.getAttribute('data-id');
    if (!id || id !== detailId) return;
    var f = {};
    if (v.videoWidth && v.videoHeight) { f.vw = v.videoWidth; f.vh = v.videoHeight; }
    if (isFinite(v.duration) && v.duration > 0) f.dur = v.duration;
    patchHist(id, f);
    updateDetail(id);
  });
}
`;
