/**
 * Klien bagian 4: halaman Buat video (form render, unggah file komposisi, draf).
 *
 * KEPUTUSAN:
 *  - Logika kirim sama dengan versi lama (POST /render, field html hanya untuk mode "Tulis baru").
 *    Validasi di klien mencerminkan validasi Worker (regex ID, batas 256 KB), Worker tetap otoritas.
 *  - File .html dibaca di browser (FileReader) lalu dimasukkan ke textarea; tidak ada endpoint baru.
 *  - Draf = salinan lokal (localStorage) komposisi yang belum dikirim; tidak pernah dikirim ke server.
 */
export const CREATE = String.raw`
/* ===== Buat video ===== */
var segMode = null, segQuality = null;

function applyMode(v) {
  var isNew = v === 'new';
  $('newBox').hidden = !isNew;
  $('fieldComp').hidden = isNew;
  $('saveDraft').hidden = !isNew;
}
function updateCount() {
  var n = byteLen($('html').value);
  var c = $('htmlCount');
  c.textContent = fmtBytes(n) + ' / 256 KB';
  c.className = 'count' + (n > MAX_HTML_BYTES ? ' over' : '');
}
// Saran nama komposisi untuk <datalist> (riwayat, aset, draf).
function refreshCompList() {
  var seen = { contoh: 1 };
  var names = ['contoh'];
  function add(n) { if (typeof n === 'string' && ID_RE.test(n) && !seen[n]) { seen[n] = 1; names.push(n); } }
  loadHist().forEach(function (it) { add(it.composition); });
  loadAssets().forEach(function (a) { add(a.composition); });
  loadDrafts().forEach(function (d) { add(d.name); });
  var dl = $('compList');
  dl.textContent = '';
  names.forEach(function (n) { var o = document.createElement('option'); o.value = n; dl.appendChild(o); });
}
function renderCreate() {
  updateKeyBars();
  refreshCompList();
  renderDraftLists();
}

function nameFromFile(name) {
  var base = String(name || '').replace(/\.[^.]*$/, '');
  var cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+/, '').slice(0, 64);
  return ID_RE.test(cleaned) ? cleaned : '';
}
async function loadHtmlFile(f) {
  var box = $('htmlFileMsg');
  setMsg(box, '');
  if (!f) return;
  if (f.size > MAX_HTML_BYTES) { setMsg(box, 'File terlalu besar (' + fmtBytes(f.size) + '). Maks 256 KB.', 'err'); $('htmlFile').value = ''; return; }
  if ($('html').value.trim() !== '') {
    var ok = await confirmBox('Ganti isi komposisi?', 'Isi kotak komposisi akan diganti dengan isi file "' + f.name + '".', 'Ganti');
    if (!ok) { $('htmlFile').value = ''; return; }
  }
  var reader = new FileReader();
  reader.onerror = function () { setMsg(box, 'File gagal dibaca. Coba pilih ulang.', 'err'); };
  reader.onload = function () {
    var text = typeof reader.result === 'string' ? reader.result : '';
    if (!text.trim()) { setMsg(box, 'File kosong.', 'err'); return; }
    $('html').value = text;
    updateCount();
    var suggested = nameFromFile(f.name);
    var filled = false;
    if (!$('newName').value.trim() && suggested && suggested.toLowerCase() !== 'index') { $('newName').value = suggested; filled = true; }
    setMsg($('formMsg'), '');
    setMsg(box, 'File "' + f.name + '" dimuat (' + fmtBytes(f.size) + ').' + (filled ? ' Nama komposisi diisi "' + suggested + '".' : '') + ' Cek isinya, lalu tekan Mulai render.', 'ok');
  };
  reader.readAsText(f);
}

/* ---------- draf ---------- */
function saveDraftNow() {
  var msg = $('formMsg');
  var html = $('html').value;
  var name = $('newName').value.trim();
  if (!html.trim()) { setMsg(msg, 'Isi komposisi masih kosong, tidak ada yang disimpan.', 'err'); return; }
  if (byteLen(html) > MAX_HTML_BYTES) { setMsg(msg, 'Isi komposisi terlalu besar (maks 256 KB).', 'err'); return; }
  if (name && !ID_RE.test(name)) { setMsg(msg, 'Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); return; }
  setMsg(msg, '');
  var list = loadDrafts();
  list.unshift({ id: 'd' + Date.now().toString(36), name: name, html: html, quality: segQuality.value || 'standard', ts: Date.now() });
  var trimmed = list.length > DRAFT_MAX;
  if (!saveDrafts(list)) { toast('Penyimpanan perangkat penuh atau tidak tersedia; draf tidak tersimpan.', 'err'); return; }
  toast(trimmed ? 'Draf disimpan. Draf tertua dihapus (maks ' + DRAFT_MAX + ').' : 'Draf disimpan.', 'ok');
  renderDraftLists();
  refreshCompList();
}
function useDraft(id) {
  var d = loadDrafts().filter(function (x) { return x.id === id; })[0];
  if (!d) return;
  segMode.set('new');
  $('newName').value = d.name;
  $('html').value = d.html;
  segQuality.set(d.quality, true);
  updateCount();
  setMsg($('formMsg'), '');
  go('create');
  toast('Draf dimuat ke form.', 'ok');
}
async function deleteDraft(id) {
  var ok = await confirmBox('Hapus draf?', 'Draf ini dihapus dari perangkat ini dan tidak bisa dikembalikan.', 'Hapus', true);
  if (!ok) return;
  saveDrafts(loadDrafts().filter(function (x) { return x.id !== id; }));
  renderDraftLists();
  toast('Draf dihapus.', 'ok');
}

function initCreate() {
  segMode = seg($('segMode'), applyMode);
  segQuality = seg($('segQuality'));
  $('html').addEventListener('input', updateCount);
  $('htmlFile').addEventListener('change', function () { loadHtmlFile($('htmlFile').files && $('htmlFile').files[0]); });
  var drop = $('htmlDrop');
  ['dragenter', 'dragover'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadHtmlFile(f);
  });
  $('tplBtn').addEventListener('click', async function () {
    if ($('html').value.trim() !== '') {
      var ok = await confirmBox('Ganti isi komposisi?', 'Isi kotak komposisi akan diganti dengan komposisi contoh.', 'Ganti');
      if (!ok) return;
    }
    $('html').value = TEMPLATE;
    updateCount();
    setMsg($('formMsg'), '');
    $('html').focus();
  });
  $('saveDraft').addEventListener('click', saveDraftNow);

  $('form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var msg = $('formMsg');
    setMsg(msg, '');
    var isNew = segMode.value === 'new';
    var qual = segQuality.value;
    var rid = $('rid').value.trim();
    var comp = '';
    var html = '';
    if (isNew) {
      comp = $('newName').value.trim();
      html = $('html').value;
      if (comp && !ID_RE.test(comp)) { setMsg(msg, 'Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); $('newName').focus(); return; }
      if (!html.trim()) { setMsg(msg, 'Isi komposisi wajib diisi.', 'err'); $('html').focus(); return; }
      if (byteLen(html) > MAX_HTML_BYTES) { setMsg(msg, 'Isi komposisi terlalu besar (maks 256 KB).', 'err'); $('html').focus(); return; }
    } else {
      comp = $('composition').value.trim() || 'contoh';
      if (!ID_RE.test(comp)) { setMsg(msg, 'Nama komposisi tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); $('composition').focus(); return; }
    }
    if (!QUALS[qual]) { setMsg(msg, 'Kualitas tidak valid.', 'err'); return; }
    if (rid && !ID_RE.test(rid)) { setMsg(msg, 'ID tidak valid (huruf, angka, _ dan -, maks 64).', 'err'); $('rid').focus(); return; }
    if (!apiKey) { setMsg(msg, 'API key belum diatur. Buka Pengaturan untuk mengisinya.', 'err'); return; }

    var payload = { quality: qual };
    if (comp) payload.composition = comp;
    if (isNew) payload.html = html;
    if (rid) payload.id = rid;

    var btn = $('submit');
    btn.disabled = true;
    btn.textContent = isNew ? 'Meng-commit & mengirim\u2026' : 'Mengirim\u2026';
    var r = await submitRender(payload, qual);
    btn.disabled = false;
    btn.textContent = 'Mulai render';
    if (r.ok) {
      $('rid').value = '';
      toast('Render dimulai: ' + r.id, 'ok');
      go('renders/' + r.id);
    } else {
      setMsg(msg, r.msg, 'err');
    }
  });
}
`;
