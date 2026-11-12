# Tampilan web HyperFrames Render (premium + mobile-first)

Dokumen ini menjelaskan keputusan desain halaman `GET /` di Worker `hyperframes-render`.
Kode ada di `cloudflare-free/worker/src/page.js`; `index.js` hanya mengimpor `htmlPage()`.

## Struktur file

| File | Isi |
| --- | --- |
| `worker/src/index.js` | Routing API (`/render`, `/asset`, `/status/:id`, `/video/:id`, `/api`) + memanggil `htmlPage()` untuk `GET /` bila browser |
| `worker/src/page.js` | Halaman web: CSS, HTML, JS klien, templat komposisi contoh, header CSP |

Alasan dipisah: logika API (aman, sensitif) tidak perlu disentuh setiap kali tampilan diubah,
dan diff desain jadi mudah dibaca. Wrangler mem-bundle impor otomatis, jadi tidak ada perubahan
pada `wrangler.jsonc` maupun workflow deploy.

## Prinsip desain

1. **Mobile-first.** Layout dasar satu kolom; grid dua kolom baru dipakai di layar > 640px.
   - Target sentuh minimal 44px (tombol utama 52px).
   - Font input **dan textarea** 16px di HP, supaya iOS Safari tidak zoom otomatis saat fokus.
   - `viewport-fit=cover` + `env(safe-area-inset-*)` untuk notch dan home indicator.
   - Tinggi memakai `dvh` agar tidak loncat saat address bar HP naik-turun.
   - Tombol aksi di kartu status membungkus 2 kolom (tombol Unduh MP4 selalu satu baris penuh).
   - Kartu Status memakai `scroll-margin-top` supaya tidak tertutup topbar sticky saat di-scroll otomatis.
2. **Tampilan premium.** Latar gelap dengan aurora gradient (satu lapisan `position:fixed`, ringan),
   kartu kaca (`backdrop-filter`), gradient aksen indigo-violet-cyan, tipografi system font dengan
   judul besar `clamp()`, ikon merek SVG inline.
   - **Di layar <= 640px blur kartu dimatikan** dan kartu memakai warna solid (`--surface-solid`),
     karena `backdrop-filter` pada banyak kartu membuat scroll berat di HP kelas bawah.
3. **Tema terang otomatis** lewat `prefers-color-scheme`. Semua warna lewat CSS variable di `:root`,
   jadi satu tempat untuk mengubah palet.
4. **Aksesibilitas.** Fokus terlihat (ring), `aria-pressed` pada segmented control, `role=status`
   pada badge, `prefers-reduced-motion` mematikan animasi, `prefers-contrast: more` menebalkan garis.
5. **Tanpa ketergantungan eksternal.** Tidak ada font web, gambar, atau CDN; semua inline.
6. **Kompatibilitas browser lama.** Setiap pemakaian `color-mix()` didahului deklarasi warna biasa
   (mis. `border-color:var(--err)`), jadi browser/WebView yang belum mendukungnya (sebelum Chrome 111 /
   Safari 16.2) tetap mendapat warna yang wajar.

## Yang sengaja TIDAK diubah (keamanan)

- CSP berbasis nonce acak per respons: `script-src` dan `style-src` hanya `'nonce-...'`.
  Karena itu **tidak boleh ada atribut `style="..."` inline** di HTML; gaya selalu lewat class.
  (Manipulasi gaya lewat JS `element.style.x` tetap diizinkan CSP dan dipakai satu kali untuk
  fallback salin ke clipboard.)
- Data dari server masuk ke DOM hanya lewat `textContent`, tidak pernah `innerHTML`.
- Validasi ID/komposisi/nama file dua lapis (klien + Worker) dan tautan run GitHub diverifikasi regex.

## Komponen baru (presentasi saja)

- **Segmented control** untuk "Sumber komposisi" dan "Kualitas". `<select>` asli tetap ada
  (disembunyikan dengan `.sr-only`) sebagai sumber nilai, sehingga logika lama
  (`el.mode.value`, `el.quality.value`) tidak berubah. Tombol hanya menyinkronkan select.
- **Progress bar indeterminate** di kartu Status selama render berjalan.
- **Penghitung ukuran** `x / 256 KB` untuk textarea komposisi (merah bila melewati batas).
- **Titik status berwarna** di riwayat (hijau selesai, kuning diproses, merah gagal).
- **Kartu bernomor** (1 Render, 2 Aset, 3 Status, 4 Riwayat) agar alur terbaca cepat.

## Aturan saat mengedit `page.js`

- Jangan memakai backtick atau `${` di dalam `PAGE_HTML` / `COMPOSITION_TEMPLATE` (keduanya `String.raw`).
- Jangan menaruh teks `__NONCE__` atau `__TEMPLATE_JSON__` selain di tempat penanda yang sudah ada.
- `COMPOSITION_TEMPLATE` adalah salinan `compositions/contoh/index.html`; perbarui keduanya bersamaan.
- Pertahankan semua `id` elemen; JS klien mengaksesnya lewat `$(id)`.
- Animasi masuk kartu memakai `.card:nth-of-type(n)`; jangan menaruh elemen `<section>` non-kartu
  sebelum kartu pertama di `<main>` (hero memakai `<div>` karena itu).

## Cara mencoba

1. Merge PR, lalu jalankan workflow **Deploy worker** (Actions > Deploy worker > Run workflow).
2. Buka URL `*.workers.dev` Worker di browser (halaman web) atau lewat `curl` (JSON info).
3. Uji di HP, atau di Chrome DevTools > Toggle device toolbar (iPhone SE 375px dan Pixel 7 412px).

## Cinematic Prompt Studio (JalurTarot + studio lain)

Halaman **Buat video** menyediakan Prompt Studio untuk menyusun brief konten dan menghasilkan prompt lengkap bagi AI coding agent.

Pilih **Studio** di bagian atas form. Setiap studio punya master prompt, pilihan jenis konten, emosi, arah visual, durasi bawaan, dan CTA bawaan sendiri:

| Studio | Fokus | Catatan akurasi di master prompt |
| --- | --- | --- |
| JalurTarot (Tarot & Spiritual) | Pesan semesta, tarot reading, numerologi | Kartu tidak boleh diacak atau dikarang |
| Motivasi & Quotes | Quote harian, mindset, self-growth | Tidak menisbatkan kutipan ke tokoh nyata |
| Promo Produk & UMKM | Peluncuran, flash sale, testimoni | Harga, diskon, dan klaim hanya dari brief |
| Edukasi & Fakta Singkat | Fakta, tips, mitos vs fakta | Angka dan sumber hanya dari brief |
| Kuliner & Resep | Resep, review tempat makan, promo menu | Bahan, takaran, harga, alamat hanya dari brief |
| Kustom (niche sendiri) | Niche lain dengan brand sendiri | Tidak ada data yang dikarang |

- Isi brand/akun, jenis konten, judul/hook, pesan utama, detail khusus studio (mis. kartu tarot, produk & harga, sumber data), emosi, durasi, arah visual, dan CTA.
- **Buat prompt lengkap** menggabungkan master prompt studio terpilih (art direction, storyboard, tipografi, motion, audio, akurasi konten, kontrak teknis HyperFrames, quality control) dengan brief saat ini.
- **Salin prompt lengkap** untuk dikirim ke BYGA AI / coding agent; **Salin brief saja** untuk memakai master prompt yang sudah disimpan di tempat lain.
- Berpindah studio mengganti pilihan, placeholder, dan label detail khusus; kolom detail khusus dikosongkan. Brand dan CTA hanya diganti bila belum diedit.
- Prompt Studio hanya membantu menghasilkan source HTML komposisi; prompt tidak dikirim ke endpoint render. HTML tetap harus dimasukkan melalui mode **Tulis baru** atau diunggah sebagai file komposisi.
- Input brief tidak disimpan ke server atau localStorage. Hindari memasukkan data rahasia.

### Menambah studio baru

Kode ada di `worker/src/ui/client-create.js`. Tambahkan nama studio ke `PS_ORDER` dan satu objek di `PS_STUDIOS`
dengan field: `name`, `short`, `eyebrow`, `intro`, `briefTitle`, `brand`, `brandPh`, `brandFallback`, `themes`, `titlePh`, `messagePh`,
`messageFallback`, `extraLabel`, `extraPh`, `extraBrief`, `extraFallback`, `moods`, `visuals`, `cta`, `ctaFallback`, `duration`,
serta `masterTitle`, `roles`, `art`, `story`, `type`, `guard` (dirangkai `psMaster()` bersama blok teknis `PS_*` yang dipakai semua studio).
JalurTarot memakai `master` tersendiri (`JALUR_TAROT_MASTER_PROMPT`) agar prompt aslinya tidak berubah.
Pemilih studio dan kolom Brand disisipkan lewat JS (`psInjectControls`), jadi `markup.js` tidak perlu diubah.
Hindari backtick dan `${` karena file memakai `String.raw`.

Semua kontrol menggunakan markup biasa, tanpa inline style atau dependency eksternal, sehingga tetap sesuai CSP dan pola mobile-first.
