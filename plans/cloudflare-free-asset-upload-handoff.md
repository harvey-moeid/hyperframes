# Handoff: dukungan asset di `cloudflare-free`

Status: **asset sudah didukung lewat `POST /asset`**. Dokumen ini dikoreksi 2026-11-15.

## Koreksi

Versi pertama dokumen ini (PR #19) menyimpulkan bahwa asset **belum** didukung dan mengusulkan
membangun endpoint upload. Itu **keliru**. Kesimpulan tersebut diambil dari `cloudflare-free/README.md`
tanpa membaca kode. Setelah `cloudflare-free/worker/src/index.js` dibaca, `POST /asset` ternyata sudah ada.
README-lah yang belum mendokumentasikannya (diperbaiki di PR yang sama dengan koreksi ini).

## Perilaku saat ini (dibaca dari `worker/src/index.js`)

`POST /asset` (header `x-api-key`), body JSON `{composition, filename, data}`:

- `composition`: nama folder komposisi, regex `^[a-zA-Z0-9_-]{1,64}$`.
- `filename`: regex `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$` (tanpa `/`, jadi tidak bisa keluar folder).
- `data`: base64 standar (base64url ditolak). Ukuran setelah decode maksimal **8 MiB** (`MAX_ASSET_BYTES`).
- Worker meng-commit ke `cloudflare-free/compositions/<composition>/assets/<filename>` lewat GitHub
  Contents API. Asset **boleh ditimpa**: sha file lama dicari lebih dulu dan disertakan.
- Balasan sukses `201`: `{ok, composition, filename, path, src: "assets/<filename>", commit_sha, bytes}`.
- Galat: `401 unauthorized`, `500 server_not_configured`, `413 body_too_large` / `asset_too_large`,
  `400 invalid_json` / `invalid_composition` / `invalid_filename` / `invalid_data` / `invalid_base64`,
  `502 commit_failed`.
- Di komposisi, rujuk asset dengan path relatif, mis. `<img src="assets/logo.png">`. Workflow melakukan
  sparse-checkout `cloudflare-free/compositions` dan merender dari folder komposisi, sehingga path relatif ikut.

## Celah dan risiko yang diketahui

Tiga yang pertama dibaca dari kode; yang lain **belum diuji**.

1. **README tidak mendokumentasikan `/asset`** (sudah ditambahkan di PR koreksi ini).
2. **Asset masuk ke riwayat git.** Tiap unggahan = satu commit biner. Aman untuk gambar dan font kecil,
   boros untuk video. Batas 8 MiB dipasang karena batas CPU dan memori Workers Free saat decode base64.
3. **Tidak ada validasi ekstensi atau isi.** Nama file apa pun yang lolos regex diterima.
4. **Kemungkinan race condition (dugaan, belum diuji).** `POST /render` tanpa `html` tidak mengirim
   `client_payload.sha`, sehingga workflow checkout `github.sha` (ujung default branch saat event).
   Bila `POST /render` dikirim sangat cepat setelah `POST /asset`, commit asset mungkin belum terlihat.
   Komentar di workflow soal "kecepatan GitHub memperbarui default branch" menunjukkan kekhawatiran serupa
   untuk `html`, yang diatasi dengan SHA.
5. **Tidak ada endpoint daftar atau hapus asset.** Menghapus harus lewat git.
6. **Dukungan di halaman web belum dicek** (`worker/src/page.js` dan `ui/` belum dibaca).
7. **Asset terikat ke nama komposisi, bukan ke `id` render.** Dua render dari komposisi yang sama berbagi asset.

## Opsi lanjutan (hanya bila perlu)

### Perbaiki race condition (kecil, disarankan bila dugaan terbukti)

- `POST /asset` sudah mengembalikan `commit_sha`. Izinkan `POST /render` menerima field `sha` opsional
  (divalidasi `SHA_RE`) yang diteruskan ke `client_payload.sha`.
- Klien mengirim `commit_sha` dari unggahan terakhir ke `/render`.
- Uji: unggah asset lalu langsung render; pastikan asset terbaca.

### Asset besar lewat R2 (hanya bila 8 MiB atau pertumbuhan repo jadi masalah)

- Simpan ke R2 `assets/<id>/<filename>`; workflow mengunduh sebelum render.
- Perlu kredensial R2 di step unduh (sebelum render) dan harus dijaga agar tidak terekspos ke kode komposisi.
- Menambah kerumitan; jangan dikerjakan sebelum kebutuhan nyata ada.

### Pembatasan ekstensi

- Allowlist (png, jpg, webp, svg, mp4, webm, mp3, wav, woff2) bila ingin lebih ketat.

## Pertanyaan terbuka

- Apakah ada kebutuhan asset di atas 8 MiB? Bila tidak, Opsi R2 tidak perlu.
- Apakah halaman web sudah punya UI unggah asset? Perlu membaca `page.js` dan `ui/`.
- Apakah dugaan race condition benar-benar terjadi? Perlu uji unggah lalu render berurutan cepat.
