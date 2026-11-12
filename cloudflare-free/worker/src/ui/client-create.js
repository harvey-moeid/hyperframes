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


/* ---------- JalurTarot Cinematic Prompt Studio ---------- */
var JALUR_TAROT_MASTER_PROMPT = [
  "# MASTER PROMPT — JALURTAROT CINEMATIC VIDEO PRODUCTION",
  "",
  "Bertindak sebagai Creative Director kelas dunia, Senior Cinematic Motion Designer, Tarot Visual Artist, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer.",
  "Buat komposisi video seperti produksi studio motion graphics premium. Jangan membuat slideshow biasa atau sekadar mengganti teks pada template.",
  "",
  "## BRAND & ART DIRECTION",
  "Brand: JALURTAROT. Karakter: mysterious, elegant, cinematic, mystical, premium, emotional, sophisticated.",
  "Palet: cosmic black #090512, royal purple #211039, mystic violet #49216D, luxury gold #F2CF7A, champagne #FFF0C3, soft white #FFF8E9.",
  "Gunakan nebula, cosmic particles, golden dust, simbol astrologi, ornamental tarot frame, volumetric light, dramatic rim light, deep shadows, subtle vignette, depth dan parallax. Glow terkontrol, jangan norak.",
  "Jaga konsistensi warna, pencahayaan, tekstur, dan identitas brand dari awal sampai akhir.",
  "",
  "## FORMAT & KOMPOSISI",
  "TikTok / Reels / Shorts. Vertikal 9:16, 1080x1920, 30 FPS. Durasi mengikuti brief.",
  "Tempatkan teks dan objek penting di safe area; sisakan ruang untuk UI TikTok. Prioritaskan keterbacaan pada layar ponsel.",
  "Setiap scene harus punya tujuan storytelling, fokus visual, ritme, dan transisi yang jelas. Buat hook kuat dalam 1–3 detik pertama.",
  "",
  "## TAROT ART DIRECTION",
  "Jika kartu disebutkan, representasikan kartu tersebut secara akurat: simbol, suit, karakter, warna, dan ikonografi jangan diacak atau diganti.",
  "Gunakan ilustrasi detail, bingkai ornamental emas, tekstur premium, pencahayaan dramatis, depth, parallax, dan rotasi 3D yang halus.",
  "Jangan mengklaim kartu tertentu muncul bila brief tidak menyebutkannya. Jangan memakai aset eksternal yang tidak tersedia. Jika tidak ada aset, buat visual abstrak relevan dengan CSS/SVG inline.",
  "",
  "## STORYBOARD & EDITING",
  "Rancang alur pembuka → pengenalan tema → pesan utama → pendalaman makna → penerapan dalam kehidupan → klimaks emosional → penutup brand/CTA.",
  "Sesuaikan jumlah scene dan pembagian waktunya dengan durasi brief; jangan memaksakan 7 scene bila ritme cerita membutuhkan struktur berbeda.",
  "Tampilkan satu gagasan utama per beat. Hindari paragraf panjang; gunakan headline singkat, kata kunci, dan narasi natural dalam Bahasa Indonesia modern.",
  "Beri jeda pada kalimat paling penting agar penonton sempat membaca dan merasakan pesannya.",
  "",
  "## TYPOGRAPHY",
  "Judul memakai serif elegan; isi memakai sans-serif bersih; kata kunci dapat memakai aksen emas.",
  "Gunakan hierarchy kuat, maksimal sekitar 5–8 kata utama per tampilan, ukuran nyaman dibaca, kontras tinggi, dan line-height cukup.",
  "Terapkan kinetic typography terukur: staggered reveal, mask reveal, word emphasis, fade/slide halus. Jangan memenuhi layar.",
  "",
  "## CINEMATIC MOTION",
  "Gunakan slow push-in, parallax depth, tracking, controlled rotation, focus transition, dramatic reveal, light sweep, particle transition, dan camera framing yang punya tujuan.",
  "Variasikan gerakan antar-scene; hindari gerakan acak, zoom berlebihan, transisi monoton, dan layar kosong tanpa alasan artistik.",
  "Gunakan easing profesional seperti power2.out, power3.out, power2.inOut, sine.inOut, expo.out. Gerakan harus halus dan punya ritme.",
  "",
  "## AUDIO",
  "Jika file audio tersedia, sinkronkan ambient cinematic, subtle mystical sound, reveal impact, dan whoosh secara halus. Jaga ruang untuk voice-over.",
  "Jangan mengarang nama file, URL, atau aset audio. Jika audio belum tersedia, buat video tetap kuat secara visual dan siap menerima audio kemudian.",
  "",
  "## HYPERFRAMES TECHNICAL CONTRACT — WAJIB",
  "Output satu file index.html lengkap yang sesuai versi HyperFrames dan pola komposisi di repository target.",
  "Gunakan root composition dengan data-composition-id, data-duration, data-width, data-height yang benar. Setiap clip berwaktu harus memiliki class clip, data-start, data-duration, data-track-index, serta ID unik.",
  "Gunakan satu root GSAP timeline dalam keadaan paused dan daftarkan ke window.__timelines memakai ID komposisi yang sama dengan data-composition-id. Timeline harus dapat di-seek deterministik pada frame mana pun.",
  "Jangan memakai Date.now(), Math.random() tanpa seed, setTimeout, setInterval, fetch, network request saat render, atau animasi repeat tak terbatas.",
  "Jangan mengubah display/visibility elemen clip melalui tween. Hindari konflik transform antara CSS dan GSAP. Pastikan elemen penting sudah ada sebelum timeline didaftarkan.",
  "Ikuti dependency, loader, dan pola GSAP yang benar-benar tersedia di repository. Jangan menambahkan CDN atau dependency baru tanpa kebutuhan dan bukti kompatibilitas.",
  "Gunakan CSS/SVG inline untuk ornamen ringan. Gunakan hanya aset yang sudah diunggah atau tersedia pada path komposisi yang benar. Jangan membuat URL atau nama file palsu.",
  "Pastikan durasi timeline tidak melebihi durasi komposisi, tidak ada dead stretch, elemen tidak terpotong, dan render konsisten saat frame di-seek maju/mundur.",
  "Pertahankan batas ukuran HTML yang diberlakukan frontend/Worker. Jangan memasukkan API key, token, atau secret ke dalam HTML.",
  "",
  "## QUALITY CONTROL",
  "Audit opening hook, storytelling, kesesuaian simbol tarot, visual hierarchy, safe area, keterbacaan, kontras, transisi, ritme, konsistensi brand, durasi, dan CTA.",
  "Periksa tidak ada teks terpotong, overlap tidak disengaja, frame kosong, flicker, animasi non-deterministik, atau error runtime.",
  "Jalankan HyperFrames lint dan check bila lingkungan tersedia. Bila belum diuji, nyatakan dengan jujur dan jangan mengklaim render berhasil.",
  "",
  "## FINAL OUTPUT",
  "Berikan satu index.html lengkap, bukan pseudocode atau potongan kode. Tidak ada TODO, placeholder yang tidak perlu, atau penjelasan yang menggantikan implementasi.",
  "Utamakan storytelling, kualitas artistik, keterbacaan, dan determinisme render. Setiap detik harus punya tujuan visual dan emosional.",
  "Jangan hanya menyalin template contoh; bangun komposisi yang spesifik terhadap brief video."
].join('\n');

function jalurTarotBrief() {
  var value = function (id, fallback) { var v = $(id).value.trim(); return v || fallback; };
  return [
    "# VIDEO PRODUCTION BRIEF — JALURTAROT",
    "Brand: JalurTarot (@jalurtarot)",
    "Jenis konten: " + value('jtTheme', 'Pesan Semesta'),
    "Judul / hook: " + value('jtTitle', '[Buat hook yang kuat dan relevan]'),
    "Pesan utama / materi narasi: " + value('jtMessage', '[Kembangkan pesan yang akurat, jelas, natural, dan tidak mengada-ada]'),
    "Kartu tarot: " + value('jtCards', 'Tidak ditentukan; jangan mengarang kartu'),
    "Emosi: " + value('jtMood', 'Misterius, penasaran, inspiratif'),
    "Durasi: " + value('jtDuration', '24') + " detik",
    "Arah visual: " + value('jtVisual', 'Dark mystical, ungu kerajaan dan emas'),
    "CTA: " + value('jtCta', 'Follow @jalurtarot'),
    "",
    "Terapkan seluruh MASTER PROMPT. Rancang storyboard dan pembagian waktu sesuai durasi. Hasil akhir satu index.html HyperFrames lengkap, deterministik, siap diperiksa dan dirender."
  ].join('\n');
}
function buildJalurTarotPrompt() {
  var result = JALUR_TAROT_MASTER_PROMPT + '\n\n' + jalurTarotBrief();
  $('jtPromptOutput').value = result;
  $('jtPromptDetails').open = true;
  $('jtPromptMsg').textContent = 'Prompt lengkap siap disalin. Tempelkan ke BYGA AI atau coding agent untuk membuat komposisi HTML.';
  return result;
}
function initJalurTarotPromptStudio() {
  $('jtBuildPrompt').addEventListener('click', buildJalurTarotPrompt);
  $('jtCopyPrompt').addEventListener('click', function () {
    copyText(buildJalurTarotPrompt(), 'Master prompt JalurTarot disalin');
  });
  $('jtCopyBrief').addEventListener('click', function () {
    copyText(jalurTarotBrief(), 'Brief video disalin');
  });
}

function initCreate() {
  initJalurTarotPromptStudio();
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