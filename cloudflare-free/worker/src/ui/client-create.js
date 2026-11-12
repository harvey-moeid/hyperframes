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


/* ---------- Cinematic Prompt Studio (JalurTarot + studio lain) ---------- */
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

/* Blok teknis & QC dipakai bersama semua studio selain JalurTarot (JalurTarot memakai master prompt aslinya). */
var PS_FORMAT = [
  "Default: TikTok / Reels / Shorts, vertikal 9:16, 1080x1920, 30 FPS, kecuali brief menyebut format lain. Durasi mengikuti brief.",
  "Tempatkan teks dan objek penting di safe area; sisakan ruang untuk UI aplikasi. Prioritaskan keterbacaan pada layar ponsel.",
  "Setiap scene harus punya tujuan storytelling, fokus visual, ritme, dan transisi yang jelas. Buat hook kuat dalam 1–3 detik pertama."
];
var PS_MOTION = [
  "Gunakan slow push-in, parallax depth, tracking, controlled rotation, focus transition, dramatic reveal, light sweep, dan camera framing yang punya tujuan.",
  "Variasikan gerakan antar-scene; hindari gerakan acak, zoom berlebihan, transisi monoton, dan layar kosong tanpa alasan artistik.",
  "Gunakan easing profesional seperti power2.out, power3.out, power2.inOut, sine.inOut, expo.out. Gerakan harus halus dan punya ritme."
];
var PS_AUDIO = [
  "Jika file audio tersedia, sinkronkan musik latar, efek reveal, dan whoosh secara halus. Jaga ruang untuk voice-over.",
  "Jangan mengarang nama file, URL, atau aset audio. Jika audio belum tersedia, buat video tetap kuat secara visual dan siap menerima audio kemudian."
];
var PS_TECH = [
  "Output satu file index.html lengkap yang sesuai versi HyperFrames dan pola komposisi di repository target.",
  "Gunakan root composition dengan data-composition-id, data-duration, data-width, data-height yang benar. Setiap clip berwaktu harus memiliki class clip, data-start, data-duration, data-track-index, serta ID unik.",
  "Gunakan satu root GSAP timeline dalam keadaan paused dan daftarkan ke window.__timelines memakai ID komposisi yang sama dengan data-composition-id. Timeline harus dapat di-seek deterministik pada frame mana pun.",
  "Jangan memakai Date.now(), Math.random() tanpa seed, setTimeout, setInterval, fetch, network request saat render, atau animasi repeat tak terbatas.",
  "Jangan mengubah display/visibility elemen clip melalui tween. Hindari konflik transform antara CSS dan GSAP. Pastikan elemen penting sudah ada sebelum timeline didaftarkan.",
  "Ikuti dependency, loader, dan pola GSAP yang benar-benar tersedia di repository. Jangan menambahkan CDN atau dependency baru tanpa kebutuhan dan bukti kompatibilitas.",
  "Gunakan CSS/SVG inline untuk ornamen dan ilustrasi ringan. Gunakan hanya aset yang sudah diunggah atau tersedia pada path komposisi yang benar. Jangan membuat URL atau nama file palsu.",
  "Pastikan durasi timeline tidak melebihi durasi komposisi, tidak ada dead stretch, elemen tidak terpotong, dan render konsisten saat frame di-seek maju/mundur.",
  "Pertahankan batas ukuran HTML yang diberlakukan frontend/Worker. Jangan memasukkan API key, token, atau secret ke dalam HTML."
];
var PS_QC = [
  "Audit opening hook, storytelling, akurasi isi terhadap brief, visual hierarchy, safe area, keterbacaan, kontras, transisi, ritme, konsistensi brand, durasi, dan CTA.",
  "Periksa tidak ada teks terpotong, overlap tidak disengaja, frame kosong, flicker, animasi non-deterministik, atau error runtime.",
  "Jalankan HyperFrames lint dan check bila lingkungan tersedia. Bila belum diuji, nyatakan dengan jujur dan jangan mengklaim render berhasil."
];
var PS_FINAL = [
  "Berikan satu index.html lengkap, bukan pseudocode atau potongan kode. Tidak ada TODO, placeholder yang tidak perlu, atau penjelasan yang menggantikan implementasi.",
  "Utamakan storytelling, kualitas artistik, keterbacaan, dan determinisme render. Setiap detik harus punya tujuan visual dan emosional.",
  "Jangan hanya menyalin template contoh; bangun komposisi yang spesifik terhadap brief video."
];
function psMaster(c) {
  return [
    "# MASTER PROMPT — " + c.masterTitle,
    "",
    "Bertindak sebagai " + c.roles + ".",
    "Buat komposisi video seperti produksi studio motion graphics premium. Jangan membuat slideshow biasa atau sekadar mengganti teks pada template.",
    "",
    "## BRAND & ART DIRECTION"
  ].concat(c.art, ["", "## FORMAT & KOMPOSISI"], PS_FORMAT, ["", "## STORYBOARD & EDITING"], c.story,
    ["", "## TYPOGRAPHY"], c.type, ["", "## CINEMATIC MOTION"], PS_MOTION, ["", "## AUDIO"], PS_AUDIO,
    ["", "## AKURASI KONTEN"], c.guard, ["", "## HYPERFRAMES TECHNICAL CONTRACT — WAJIB"], PS_TECH,
    ["", "## QUALITY CONTROL"], PS_QC, ["", "## FINAL OUTPUT"], PS_FINAL).join('\n');
}

var PS_ORDER = ['tarot', 'motivasi', 'promo', 'edukasi', 'kuliner', 'custom'];
var PS_STUDIOS = {
  tarot: {
    name: 'JalurTarot · Tarot & Spiritual', short: 'JalurTarot',
    eyebrow: 'JALUR TAROT · CREATIVE WORKSPACE',
    intro: 'Susun brief video, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — JALURTAROT',
    brand: 'JalurTarot (@jalurtarot)', brandPh: 'Contoh: JalurTarot (@jalurtarot)', brandFallback: 'JalurTarot (@jalurtarot)',
    themes: ['Pesan Semesta', 'Tarot Reading', 'Numerologi', 'Asmara & Hubungan', 'Keuangan & Rezeki', 'Karier', 'Pick a Card', 'Pesan Harian'],
    titlePh: 'Contoh: Pesan Semesta Hari Ini',
    messagePh: 'Tuliskan inti pesan yang ingin disampaikan kepada penonton...',
    messageFallback: '[Kembangkan pesan yang akurat, jelas, natural, dan tidak mengada-ada]',
    extraLabel: 'Kartu tarot (opsional)', extraPh: 'Contoh: The Magician, The Star', extraBrief: 'Kartu tarot',
    extraFallback: 'Tidak ditentukan; jangan mengarang kartu',
    moods: ['Misterius, penasaran, inspiratif', 'Romantis, hangat, emosional', 'Dramatis, intens, penuh harapan', 'Tenang, spiritual, reflektif', 'Optimistis, energik, penuh peluang'],
    visuals: ['Dark mystical, ungu kerajaan dan emas', 'Celestial gold, kosmik dan elegan', 'Gothic tarot, gelap dan dramatis', 'Ethereal purple, lembut dan magis'],
    cta: 'Follow @jalurtarot untuk pesan berikutnya', ctaFallback: 'Follow @jalurtarot',
    duration: '24',
    master: JALUR_TAROT_MASTER_PROMPT
  },
  motivasi: {
    name: 'Motivasi & Quotes', short: 'Motivasi',
    eyebrow: 'MOTIVASI · CREATIVE WORKSPACE',
    intro: 'Susun brief video motivasi atau quote, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — MOTIVASI & QUOTES',
    brand: '', brandPh: 'Contoh: @akunmotivasi', brandFallback: 'Tidak ditentukan; gunakan penanda brand netral dan jangan mengarang nama akun',
    themes: ['Motivasi Pagi', 'Quote Harian', 'Self-Growth', 'Mindset Bisnis', 'Healing & Ketenangan', 'Bangkit dari Kegagalan'],
    titlePh: 'Contoh: Kamu Tidak Terlambat',
    messagePh: 'Tuliskan pesan inti atau narasi motivasi yang ingin disampaikan...',
    messageFallback: '[Kembangkan pesan yang relevan, tulus, dan tidak menggurui]',
    extraLabel: 'Kutipan / kata kunci (opsional)', extraPh: 'Contoh: Konsisten lebih kuat dari motivasi', extraBrief: 'Kutipan / kata kunci',
    extraFallback: 'Tidak ditentukan; jangan mengarang kutipan dan jangan menisbatkan kutipan kepada tokoh nyata',
    moods: ['Membakar semangat, tegas, bertenaga', 'Hangat, menenangkan, penuh harapan', 'Reflektif, dalam, emosional', 'Tenang, fokus, disiplin'],
    visuals: ['Minimal bold, tipografi besar dan kontras tinggi', 'Golden hour sinematik, hangat dan luas', 'Dark urban, kontras tinggi dan dramatis', 'Pastel lembut, tenang dan bersih'],
    cta: 'Follow untuk motivasi harian', ctaFallback: 'Follow untuk motivasi harian',
    duration: '24',
    masterTitle: 'CINEMATIC MOTIVATIONAL VIDEO PRODUCTION',
    roles: 'Creative Director kelas dunia, Senior Cinematic Motion Designer, Kinetic Typography Artist, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer',
    art: [
      "Karakter: inspiring, powerful, clean, modern, emosional namun tidak menggurui. Identitas brand mengikuti brief; jika tidak ada, gunakan penanda brand netral.",
      "Tentukan satu palet konsisten (maksimal 3–4 warna) sesuai arah visual. Gunakan metafora visual yang sederhana: matahari terbit, jalan panjang, tangga, gunung, siluet abstrak, cahaya yang menembus gelap.",
      "Gunakan CSS/SVG untuk siluet dan elemen abstrak. Jangan memakai foto atau wajah orang nyata kecuali aset sudah tersedia. Glow dan grain terkontrol, jaga konsistensi dari awal sampai akhir."
    ],
    story: [
      "Rancang alur: hook kuat (pernyataan atau pertanyaan) → masalah yang relatable → titik balik → pesan inti → langkah kecil yang bisa dilakukan → penutup dan CTA.",
      "Satu gagasan per beat, satu kalimat per tampilan. Beri jeda pada kalimat paling penting agar penonton sempat merasakan pesannya.",
      "Sesuaikan jumlah scene dengan durasi brief; jangan memaksakan struktur bila ritme cerita membutuhkan yang lain."
    ],
    type: [
      "Headline sans-serif tebal berukuran besar; kata kunci diberi aksen warna. Maksimal sekitar 5–8 kata utama per tampilan, kontras tinggi, line-height cukup.",
      "Terapkan kinetic typography yang ritmis: staggered reveal, mask reveal, word emphasis, scale dan fade halus yang sinkron dengan jeda narasi."
    ],
    guard: [
      "Gunakan hanya kutipan dan pesan dari brief. Jangan menisbatkan kutipan kepada tokoh nyata dan jangan mengarang statistik.",
      "Hindari janji hasil pasti, klaim medis atau finansial, serta bahasa yang menyudutkan atau merendahkan penonton."
    ]
  },
  promo: {
    name: 'Promo Produk & UMKM', short: 'Promo Produk',
    eyebrow: 'PROMO PRODUK · CREATIVE WORKSPACE',
    intro: 'Susun brief video promosi produk, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — PROMO PRODUK',
    brand: '', brandPh: 'Contoh: Kopi Nusantara (@kopinusantara)', brandFallback: 'Tidak ditentukan; gunakan penanda brand netral dan jangan mengarang nama brand',
    themes: ['Peluncuran Produk', 'Diskon & Flash Sale', 'Showcase Fitur & Manfaat', 'Testimoni Pelanggan', 'Paket Bundling', 'Cara Pemakaian'],
    titlePh: 'Contoh: Flash Sale Akhir Pekan',
    messagePh: 'Tuliskan keunggulan, manfaat, dan penawaran yang ingin disampaikan...',
    messageFallback: '[Kembangkan pesan penjualan yang jelas dan jujur berdasarkan data brief]',
    extraLabel: 'Nama produk, harga & promo', extraPh: 'Contoh: Kopi Gayo 250g, Rp55.000, diskon 20% sampai Minggu', extraBrief: 'Produk, harga & promo',
    extraFallback: 'Tidak ditentukan; jangan mengarang harga, diskon, stok, atau klaim produk',
    moods: ['Energik, meyakinkan, mendesak', 'Hangat, ramah, tepercaya', 'Mewah, elegan, eksklusif', 'Ceria, playful, menarik perhatian'],
    visuals: ['Clean commercial, produk jadi pusat perhatian', 'Bold retail, warna kontras dan dinamis', 'Premium minimal, gelap dan elegan', 'Warna cerah, playful dan modern'],
    cta: 'Pesan sekarang lewat link di bio', ctaFallback: 'Pesan sekarang',
    duration: '30',
    masterTitle: 'CINEMATIC PRODUCT PROMO VIDEO PRODUCTION',
    roles: 'Creative Director iklan kelas dunia, Senior Commercial Motion Designer, Product Visual Artist, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer',
    art: [
      "Karakter: profesional, meyakinkan, bersih, dan menarik secara komersial. Identitas brand, warna, dan nada bahasa mengikuti brief.",
      "Jadikan produk dan penawaran sebagai fokus visual. Gunakan pencahayaan produk, depth, bayangan lembut, dan highlight sweep yang elegan; hindari efek berlebihan yang mengalihkan perhatian dari produk.",
      "Jika foto produk belum tersedia, bentuk representasi produk abstrak dengan CSS/SVG dan beri tahu pengguna bahwa aset asli perlu diunggah. Jangan membuat URL atau file palsu."
    ],
    story: [
      "Rancang alur: hook masalah atau manfaat → reveal produk → 2–3 keunggulan utama → penawaran (harga, promo, batas waktu) → CTA kuat.",
      "Satu gagasan per beat. Tampilkan harga dan promo cukup lama agar terbaca, dan ulangi CTA di akhir.",
      "Sesuaikan jumlah scene dengan durasi brief."
    ],
    type: [
      "Judul tebal dan jelas; harga dan promo memakai ukuran paling dominan dengan kontras tinggi. Maksimal sekitar 5–8 kata utama per tampilan.",
      "Gunakan badge, label, atau stempel promo yang bersih. Kinetic typography terukur: reveal bertahap, pop halus, tidak memenuhi layar."
    ],
    guard: [
      "Harga, diskon, periode promo, stok, dan kontak hanya boleh berasal dari brief. Jangan mengarang angka apa pun.",
      "Jangan memakai klaim absolut seperti terbaik, nomor 1, aman, atau menyembuhkan tanpa bukti di brief. Testimoni hanya jika diberikan; jangan mengarang nama atau kutipan pelanggan."
    ]
  },
  edukasi: {
    name: 'Edukasi & Fakta Singkat', short: 'Edukasi',
    eyebrow: 'EDUKASI · CREATIVE WORKSPACE',
    intro: 'Susun brief video edukasi atau fakta singkat, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — EDUKASI & FAKTA SINGKAT',
    brand: '', brandPh: 'Contoh: @akunedukasi', brandFallback: 'Tidak ditentukan; gunakan penanda brand netral dan jangan mengarang nama akun',
    themes: ['Fakta Singkat', 'Tips Cepat', 'Penjelasan Konsep', 'Mitos vs Fakta', 'Langkah demi Langkah', 'Sejarah Singkat'],
    titlePh: 'Contoh: 3 Fakta Menarik tentang Laut',
    messagePh: 'Tuliskan poin materi yang ingin dijelaskan, urut dari yang terpenting...',
    messageFallback: '[Susun penjelasan yang akurat, runtut, dan mudah dipahami berdasarkan brief]',
    extraLabel: 'Sumber / data pendukung (opsional)', extraPh: 'Contoh: Data BPS 2024, nama jurnal, atau tautan sumber', extraBrief: 'Sumber / data pendukung',
    extraFallback: 'Tidak ditentukan; jangan mengarang angka, statistik, atau sumber',
    moods: ['Jelas, ramah, bikin penasaran', 'Serius, tepercaya, informatif', 'Santai, ringan, menghibur', 'Inspiratif, membuka wawasan'],
    visuals: ['Infografis modern, bersih dan terstruktur', 'Dark tech, neon halus dan presisi', 'Papan tulis digital, hangat dan intuitif', 'Editorial minimal, rapi dan elegan'],
    cta: 'Follow untuk fakta menarik lainnya', ctaFallback: 'Follow untuk konten edukasi berikutnya',
    duration: '45',
    masterTitle: 'CINEMATIC EDUCATIONAL VIDEO PRODUCTION',
    roles: 'Creative Director edukasi kelas dunia, Senior Explainer Motion Designer, Information Designer, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer',
    art: [
      "Karakter: jelas, tepercaya, modern, dan menarik. Identitas brand mengikuti brief; jika tidak ada, gunakan penanda brand netral.",
      "Gunakan palet terbatas dengan satu warna aksen untuk kata kunci dan data penting. Visual pendukung berupa diagram, ikon, grafik, dan peta sederhana yang dibuat dengan CSS/SVG inline.",
      "Setiap elemen visual harus membantu pemahaman, bukan sekadar dekorasi. Jaga konsistensi gaya ikon dan garis dari awal sampai akhir."
    ],
    story: [
      "Rancang alur: hook berupa pertanyaan atau fakta mengejutkan → konteks singkat → poin 1..n (satu ide per beat, dengan visual pendukung) → ringkasan satu kalimat → CTA.",
      "Urutkan dari yang paling mudah ke yang paling mendalam. Beri waktu cukup agar teks dan diagram bisa dibaca sebelum berpindah beat.",
      "Sesuaikan jumlah poin dengan durasi brief; lebih baik sedikit poin yang jelas daripada banyak poin yang terburu-buru."
    ],
    type: [
      "Judul dan kata kunci memakai sans-serif tebal yang bersih; angka dan istilah penting diberi aksen warna. Maksimal sekitar 6–10 kata per tampilan.",
      "Gunakan reveal bertahap yang mengikuti urutan penjelasan; hindari paragraf panjang dan animasi yang menutupi data."
    ],
    guard: [
      "Setiap fakta, angka, dan istilah hanya boleh berasal dari brief. Jangan mengarang statistik, tahun, atau sumber; bila ada sumber di brief, tampilkan di layar.",
      "Jangan menarik kesimpulan melebihi data yang diberikan. Hindari nasihat medis, hukum, atau keuangan yang spesifik dan klaim yang belum terverifikasi."
    ]
  },
  kuliner: {
    name: 'Kuliner & Resep', short: 'Kuliner',
    eyebrow: 'KULINER · CREATIVE WORKSPACE',
    intro: 'Susun brief video kuliner atau resep, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — KULINER & RESEP',
    brand: '', brandPh: 'Contoh: Dapur Nusantara (@dapurnusantara)', brandFallback: 'Tidak ditentukan; gunakan penanda brand netral dan jangan mengarang nama brand',
    themes: ['Resep Singkat', 'Review Tempat Makan', 'Promo Menu', 'Menu Baru', 'Behind the Kitchen', 'Tips Masak'],
    titlePh: 'Contoh: Nasi Goreng Kampung 10 Menit',
    messagePh: 'Tuliskan langkah, rasa, atau cerita menu yang ingin disampaikan...',
    messageFallback: '[Susun narasi yang menggugah selera berdasarkan data brief]',
    extraLabel: 'Nama menu / bahan utama', extraPh: 'Contoh: Nasi goreng kampung — telur, cabai, bawang', extraBrief: 'Menu / bahan',
    extraFallback: 'Tidak ditentukan; jangan mengarang bahan, takaran, harga, atau alamat',
    moods: ['Menggugah selera, hangat, nikmat', 'Segar, ceria, energik', 'Rumahan, nostalgia, nyaman', 'Premium, elegan, sensual'],
    visuals: ['Warm food cinematic, close-up hangat dan berkilau', 'Rustic hangat, kayu dan cahaya natural', 'Modern clean, cerah dan minimal', 'Dark moody, kontras dan dramatis'],
    cta: 'Simpan resepnya dan coba di rumah', ctaFallback: 'Follow untuk resep berikutnya',
    duration: '30',
    masterTitle: 'CINEMATIC FOOD & RECIPE VIDEO PRODUCTION',
    roles: 'Creative Director kuliner kelas dunia, Senior Food Motion Designer, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer',
    art: [
      "Karakter: menggugah selera, hangat, segar, dan autentik. Identitas brand mengikuti brief; jika tidak ada, gunakan penanda brand netral.",
      "Gunakan palet hangat sesuai arah visual, pencahayaan lembut, efek uap, kilau, dan percikan yang halus. Tonjolkan tekstur dan warna bahan.",
      "Jika foto makanan belum tersedia, buat ilustrasi abstrak atau bentuk sederhana dengan CSS/SVG dan beri tahu pengguna bahwa aset asli perlu diunggah. Jangan membuat URL atau file palsu."
    ],
    story: [
      "Rancang alur: hook visual yang menggugah selera → pengenalan menu atau tempat → bahan atau keunggulan → proses atau langkah singkat → hasil akhir yang memuaskan → CTA.",
      "Satu langkah atau gagasan per beat. Beri jeda pada momen hasil akhir agar terasa memuaskan.",
      "Sesuaikan jumlah scene dengan durasi brief."
    ],
    type: [
      "Judul memakai tipografi hangat yang mudah dibaca; bahan, takaran, dan langkah memakai sans-serif bersih dengan kontras tinggi. Maksimal sekitar 5–8 kata utama per tampilan.",
      "Gunakan label bahan dan nomor langkah yang rapi. Reveal bertahap, tidak memenuhi layar."
    ],
    guard: [
      "Bahan, takaran, langkah, harga, jam buka, dan alamat hanya boleh berasal dari brief. Jangan mengarang review atau testimoni.",
      "Jangan mengklaim halal, sehat, atau higienis tanpa data di brief. Hindari klaim kesehatan atau diet yang spesifik."
    ]
  },
  custom: {
    name: 'Kustom (niche sendiri)', short: 'Kustom',
    eyebrow: 'CUSTOM · CREATIVE WORKSPACE',
    intro: 'Untuk niche lain: isi brand, topik, dan arah visual sendiri, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.',
    briefTitle: 'VIDEO PRODUCTION BRIEF — KUSTOM',
    brand: '', brandPh: 'Nama brand atau akun Anda', brandFallback: 'Tidak ditentukan; gunakan penanda brand netral dan jangan mengarang nama brand',
    themes: ['Promosi', 'Edukasi', 'Storytelling', 'Pengumuman', 'Profil Brand', 'Highlight Acara'],
    titlePh: 'Contoh: Judul atau hook video Anda',
    messagePh: 'Tuliskan isi, pesan, atau narasi yang ingin disampaikan...',
    messageFallback: '[Kembangkan pesan yang jelas dan akurat berdasarkan brief]',
    extraLabel: 'Detail khusus (opsional)', extraPh: 'Data, nama, atau elemen yang wajib muncul', extraBrief: 'Detail khusus',
    extraFallback: 'Tidak ada; jangan mengarang data, nama, atau angka',
    moods: ['Profesional, tepercaya, jelas', 'Energik, antusias, dinamis', 'Hangat, personal, bersahabat', 'Elegan, tenang, berkelas'],
    visuals: ['Cinematic gelap, kontras dan elegan', 'Terang bersih, modern dan minimal', 'Warna berani, dinamis dan energik', 'Hangat natural, organik dan tenang'],
    cta: '', ctaFallback: 'Tidak ditentukan; gunakan CTA netral yang sesuai konteks',
    duration: '30',
    masterTitle: 'CINEMATIC VIDEO PRODUCTION',
    roles: 'Creative Director kelas dunia, Senior Cinematic Motion Designer, Video Editor, GSAP Animation Engineer, dan HyperFrames HTML Video Engineer',
    art: [
      "Tentukan identitas visual (palet maksimal 3–4 warna, mood, pencahayaan, dan gaya ilustrasi) dari brand, nada, dan arah visual di brief, lalu pertahankan konsistensinya dari awal sampai akhir.",
      "Gunakan depth, parallax, dan pencahayaan yang sesuai karakter brand. Glow dan efek dikendalikan; jangan norak dan jangan menutupi pesan utama.",
      "Gunakan CSS/SVG inline untuk elemen visual bila tidak ada aset. Jangan memakai foto atau logo yang tidak tersedia, dan jangan membuat URL atau file palsu."
    ],
    story: [
      "Rancang alur sesuai tujuan video: hook kuat → konteks → pesan inti → pendalaman atau bukti → klimaks → penutup dan CTA.",
      "Satu gagasan utama per beat. Sesuaikan jumlah scene dan pembagian waktu dengan durasi brief; jangan memaksakan struktur tetap bila ritme cerita membutuhkan yang lain."
    ],
    type: [
      "Pilih pasangan tipografi yang sesuai karakter brand (judul dan isi), hierarchy kuat, maksimal sekitar 5–8 kata utama per tampilan, kontras tinggi, line-height cukup.",
      "Terapkan kinetic typography terukur: staggered reveal, mask reveal, word emphasis, fade atau slide halus. Jangan memenuhi layar."
    ],
    guard: [
      "Semua nama, angka, harga, tanggal, dan klaim hanya boleh berasal dari brief. Jangan mengarang data apa pun.",
      "Hindari klaim absolut, janji hasil pasti, serta klaim medis, hukum, atau finansial yang tidak didukung brief."
    ]
  }
};
var psCurrent = 'tarot';

function psStudio() { return PS_STUDIOS[psCurrent] || PS_STUDIOS.tarot; }
function psFill(sel, list, def) {
  sel.textContent = '';
  list.forEach(function (t) {
    var o = document.createElement('option');
    o.textContent = t;
    sel.appendChild(o);
  });
  sel.value = def || list[0];
}
function psBrief() {
  var c = psStudio();
  var value = function (id, fallback) { var v = $(id).value.trim(); return v || fallback; };
  return [
    "# " + c.briefTitle,
    "Brand: " + value('jtBrand', c.brandFallback),
    "Jenis konten: " + value('jtTheme', c.themes[0]),
    "Judul / hook: " + value('jtTitle', '[Buat hook yang kuat dan relevan]'),
    "Pesan utama / materi narasi: " + value('jtMessage', c.messageFallback),
    c.extraBrief + ": " + value('jtCards', c.extraFallback),
    "Emosi: " + value('jtMood', c.moods[0]),
    "Durasi: " + value('jtDuration', c.duration) + " detik",
    "Arah visual: " + value('jtVisual', c.visuals[0]),
    "CTA: " + value('jtCta', c.ctaFallback),
    "",
    "Terapkan seluruh MASTER PROMPT. Rancang storyboard dan pembagian waktu sesuai durasi. Hasil akhir satu index.html HyperFrames lengkap, deterministik, siap diperiksa dan dirender."
  ].join('\n');
}
function psBuildPrompt() {
  var c = psStudio();
  var master = c.master || psMaster(c);
  var result = master + '\n\n' + psBrief();
  $('jtPromptOutput').value = result;
  $('jtPromptDetails').open = true;
  $('jtPromptMsg').textContent = 'Prompt lengkap studio ' + c.short + ' siap disalin. Tempelkan ke BYGA AI atau coding agent untuk membuat komposisi HTML.';
  return result;
}
// Terapkan konfigurasi studio ke form. Brand dan CTA hanya diganti bila belum diedit pengguna.
function psApplyStudio(key) {
  if (!PS_STUDIOS[key]) return;
  var prev = psStudio();
  var c = PS_STUDIOS[key];
  qs('.prompt-eyebrow').textContent = c.eyebrow;
  qs('.prompt-head .hint').textContent = c.intro;
  psFill($('jtTheme'), c.themes, c.themes[0]);
  psFill($('jtMood'), c.moods, c.moods[0]);
  psFill($('jtVisual'), c.visuals, c.visuals[0]);
  $('jtDuration').value = c.duration;
  $('jtTitle').placeholder = c.titlePh;
  $('jtMessage').placeholder = c.messagePh;
  qs('label[for="jtCards"]').textContent = c.extraLabel;
  $('jtCards').placeholder = c.extraPh;
  $('jtCards').value = '';
  var brand = $('jtBrand');
  if (!brand.value.trim() || brand.value === prev.brand) brand.value = c.brand;
  brand.placeholder = c.brandPh;
  var cta = $('jtCta');
  if (!cta.value.trim() || cta.value === prev.cta) cta.value = c.cta;
  $('jtPromptOutput').value = '';
  $('jtPromptDetails').open = false;
  $('jtPromptMsg').textContent = 'Studio ' + c.short + ' dipilih. Isi brief di atas, lalu buat prompt lengkap.';
  psCurrent = key;
}
// Tambahkan pemilih studio dan kolom brand ke form Prompt Studio (markup tetap berisi bidang JalurTarot).
function psInjectControls() {
  var grid = qs('.prompt-fields');
  var fs = h('div', 'field prompt-wide');
  var ls = h('label', null, 'Studio');
  ls.setAttribute('for', 'jtStudio');
  var sel = document.createElement('select');
  sel.id = 'jtStudio';
  PS_ORDER.forEach(function (k) {
    var o = document.createElement('option');
    o.value = k;
    o.textContent = PS_STUDIOS[k].name;
    sel.appendChild(o);
  });
  fs.appendChild(ls);
  fs.appendChild(sel);
  var fb = h('div', 'field prompt-wide');
  var lb = h('label', null, 'Brand / akun');
  lb.setAttribute('for', 'jtBrand');
  var inp = document.createElement('input');
  inp.id = 'jtBrand';
  inp.type = 'text';
  inp.maxLength = 80;
  inp.value = PS_STUDIOS.tarot.brand;
  inp.placeholder = PS_STUDIOS.tarot.brandPh;
  fb.appendChild(lb);
  fb.appendChild(inp);
  grid.insertBefore(fb, grid.firstChild);
  grid.insertBefore(fs, grid.firstChild);
  sel.addEventListener('change', function () { psApplyStudio(sel.value); });
}
function initPromptStudio() {
  psInjectControls();
  $('jtBuildPrompt').addEventListener('click', psBuildPrompt);
  $('jtCopyPrompt').addEventListener('click', function () {
    copyText(psBuildPrompt(), 'Master prompt ' + psStudio().short + ' disalin');
  });
  $('jtCopyBrief').addEventListener('click', function () {
    copyText(psBrief(), 'Brief video disalin');
  });
}

function initCreate() {
  initPromptStudio();
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
