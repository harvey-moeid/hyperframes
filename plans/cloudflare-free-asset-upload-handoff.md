# Handoff: dukungan tambah asset di `cloudflare-free`

Status: **rencana, belum diimplementasi**. Dibuat 2026-11-15.

## Pertanyaan awal

Apakah layanan render `cloudflare-free` (Worker + halaman web) sudah mendukung penambahan asset
(gambar, video, audio, font) ke komposisi?

## Temuan saat ini (dari `cloudflare-free/README.md` dan struktur folder)

**Belum didukung.** Dasarnya:

- `POST /render` hanya menerima field `html` (isi `index.html`). Worker meng-commit satu file saja:
  `cloudflare-free/compositions/<nama>/index.html`.
- Tidak ada endpoint atau field untuk mengunggah file lain. README tidak menyebut upload asset.
- Batas `html` adalah 256 KB (`MAX_HTML_BYTES`, dijaga kecil karena batas 10 ms CPU Workers Free),
  sehingga base64 inline di dalam HTML juga cepat mentok.
- File komposisi yang sudah ada tidak pernah ditimpa (`409 composition_already_exists`).

> Catatan verifikasi: kesimpulan di atas dari README dan daftar folder. Kode
> `cloudflare-free/worker/src/worker.js` dan `index.js` **belum dibaca** baris per baris.
> Langkah pertama implementasi: baca keduanya untuk memastikan tidak ada penanganan asset tersembunyi.

## Cara kerja sementara (tanpa perubahan kode)

1. Pakai URL eksternal di HTML, misalnya `<video src="https://...">`. Runner GitHub Actions harus
   bisa mengakses URL itu saat render.
2. Commit file asset manual ke `cloudflare-free/compositions/<nama>/`, lalu render tanpa `html`
   dengan `composition: "<nama>"`.
3. Render lokal dengan `npx hyperframes render` sudah mendukung media (`src="intro.mp4"`,
   `src="music.wav"`); skill `/media-use` membantu menyiapkan media.

## Batasan yang harus dijaga

- Workers Free: 10 ms CPU per invocation, jadi Worker tidak boleh memproses atau meng-encode file besar.
- Body request Workers dibatasi ukuran tertentu; asset besar sebaiknya **tidak** lewat body `/render`.
  Cek batas terbaru di dokumentasi Cloudflare sebelum memilih desain.
- R2 free tier: 10 GB-bulan penyimpanan, 1 juta operasi Class A, 10 juta Class B per bulan.
- Setiap commit menambah riwayat git. Asset biner besar di git tidak disarankan (repo ini sudah memakai
  Git LFS untuk baseline test `.mp4`, sekitar 240 MB).
- Konten komposisi dijalankan sebagai kode di Chrome pada runner. Asset dari pengguna harus diperlakukan
  tidak tepercaya; secret Cloudflare hanya boleh ada di step setelah render.
- Validasi nama: folder `^[a-zA-Z0-9_-]{1,64}$`. Nama file asset perlu aturan sejenis agar tidak bisa
  keluar folder atau menyentuh `.github/`.

## Opsi desain

### Opsi A: asset ke R2, workflow mengunduh sebelum render (disarankan)

- Endpoint baru, misalnya `PUT /asset/:id/:filename` (auth `x-api-key`), menyimpan ke R2:
  `assets/<id>/<filename>`.
- `POST /render` menerima daftar `assets: ["logo.png", ...]` (nama file yang sudah diunggah untuk `id` itu).
- Workflow `render-video.yml`: sebelum `hyperframes render`, unduh `assets/<id>/*` dari R2 ke folder
  komposisi (`wrangler r2 object get --remote`), lalu render.
- Komposisi merujuk asset dengan path relatif (`src="logo.png"`).
- Plus: tidak menambah commit biner, memanfaatkan R2 free tier.
- Minus: perlu secret R2 juga di step unduh (sebelum render); jaga agar tidak terekspos ke kode komposisi,
  misalnya unduh di step terpisah dan hapus kredensial dari env step render.

### Opsi B: Worker meng-commit asset ke repo lewat Contents API

- Mirip alur `html` yang sudah ada, tetapi untuk file biner (base64).
- Plus: tidak perlu mengubah workflow.
- Minus: riwayat git membengkak, batas ukuran Contents API, dan boros CPU Workers Free.
  Tidak cocok untuk video atau audio.

### Opsi C: hanya URL eksternal, dengan allowlist dan unduh di workflow

- Field `assets: [{url, filename}]`; workflow mengunduh dengan batas ukuran dan tipe.
- Plus: Worker tetap ringan.
- Minus: bergantung pada hosting pihak lain; perlu perlindungan SSRF dan batas ukuran.

**Rekomendasi:** Opsi A. Opsi C bisa menyusul sebagai tambahan.

## Rencana implementasi (Opsi A)

1. Baca `worker/src/worker.js`, `worker/src/index.js`, dan `.github/workflows/render-video.yml`.
2. Putuskan batas: ukuran per file, jumlah file per render, ekstensi yang diizinkan
   (mis. png, jpg, webp, svg, mp4, webm, mp3, wav, woff2).
3. Worker: tambah `PUT /asset/:id/:filename`, validasi `id` dan `filename` dengan regex, cek `x-api-key`
   (`timingSafeEqual`), tulis ke R2 lewat binding `VIDEOS`.
4. Worker: perluas `POST /render` dengan field `assets`; tolak bila ada nama yang belum diunggah.
5. Workflow: tambah step unduh asset dari R2 ke folder komposisi sebelum render; input diteruskan lewat
   `env:`, bukan interpolasi ke shell.
6. Halaman web: tambah input pilih file, progres unggah, dan daftar asset per render.
7. README: perbarui tabel API, bagian batas gratis, dan keamanan.
8. Pembersihan: dokumentasikan penghapusan `assets/<id>/*` lama, atau pasang lifecycle rule R2.

## Pengujian

- Unggah asset kecil, render komposisi yang memakai `<img src="...">`, cek hasil MP4.
- Nama file tidak valid (`../x`, spasi, terlalu panjang) harus ditolak.
- File melebihi batas harus ditolak dengan kode yang jelas.
- Render dengan asset yang belum diunggah harus gagal di Worker, bukan di runner.
- Pastikan secret Cloudflare tidak tersedia di step render.

## Pertanyaan terbuka

- Batas ukuran per file dan total per render yang diinginkan?
- Jenis asset yang wajib didukung di tahap pertama (gambar saja, atau juga video dan audio)?
- Apakah asset perlu bisa dipakai ulang antar render (library asset), atau cukup per `id` render?
