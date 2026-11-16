# Handoff: dukungan asset di `cloudflare-free`

Status: **UI unggah asset dan `POST /asset` sudah ada; dukungan SHA eksplisit dan asset besar melalui R2 ditambahkan pada branch PR ini.** Belum ada verifikasi terhadap Worker yang di-deploy.

## Bukti UI (dibaca dari kode di `main`)

Halaman web sudah memiliki UI unggah asset. Bukti:

- `cloudflare-free/worker/src/ui/markup.js`: halaman Media memiliki input file `id="mFile"` (multiple), label drag-and-drop `id="mDrop"`, input komposisi `mComp`, dan pesan status `mMsg`.
- `cloudflare-free/worker/src/page.js`: `mediaUpload(file)` membaca file dengan `FileReader`, mengirim JSON ke `POST /asset`, dan `initMedia()` memasang event `change` serta `drop`.
- `renderMedia()` menampilkan pustaka asset lokal. Bukan daftar server: daftar itu disimpan di penyimpanan browser.
- Batas UI yang ada tetap 8 MiB per file. UI ini tidak diubah untuk upload besar karena instruksi penambahan UI hanya berlaku bila UI upload belum ada.

## Perilaku endpoint kecil yang sudah ada

`POST /asset` (header `x-api-key`), body JSON `{composition, filename, data}`:

- `composition`: `^[a-zA-Z0-9_-]{1,64}$`.
- `filename`: `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$`.
- `data`: base64 standar, maksimal 8 MiB setelah decode.
- Commit ke `cloudflare-free/compositions/<composition>/assets/<filename>` melalui GitHub Contents API; file boleh ditimpa.
- Balasan sukses memuat `src: "assets/<filename>"` dan `commit_sha`.

## Perubahan pada branch PR

1. `POST /render` menerima `sha` opsional, divalidasi dengan `SHA_RE` (40 karakter hex lowercase) dan diteruskan ke `client_payload.sha`. SHA hasil commit HTML tetap diprioritaskan. Tanpa field `sha`, perilaku sebelumnya tidak berubah.
2. `PUT /asset-large/:composition/:filename` menerima body biner mentah, bukan JSON/base64, dengan `Content-Length` wajib. Validasi nama menggunakan regex `ID_RE` dan `ASSET_NAME_RE` yang sama dengan Worker.
3. Asset besar disimpan pada bucket R2 yang sama dengan render, dengan key `assets/<composition>/<filename>`. Batas aplikasi: lebih dari 8 MiB sampai 90 MiB per file.
4. Workflow `render-video.yml` mengunduh seluruh objek pada prefix `assets/<composition>/` sebelum render, lalu menyimpannya ke `cloudflare-free/compositions/<composition>/assets/`.
5. Token R2 berada pada environment step yang perlu mengakses R2 (unduh asset, unggah MP4, penanda gagal), bukan pada step yang menjalankan komposisi.

## Dasar batas Cloudflare dan strategi stream

- Dokumentasi Cloudflare menyatakan batas request body untuk zona Free adalah 100 MB; batas CPU Workers Free 10 ms per request dan memori 128 MB.
- R2 `Bucket.put()` menerima `ReadableStream`, tetapi stream harus memiliki panjang yang diketahui (misalnya request body dengan `Content-Length`).
- Implementasi meneruskan `request.body` langsung ke R2, tanpa `arrayBuffer()` atau base64. Streaming menghindari buffering seluruh file; ini **bukan jaminan** bahwa CPU selalu di bawah 10 ms.
- Batas 90 MiB dipilih sebagai batas aplikasi konservatif di bawah 100 MB. Worker yang di-deploy tetap diperlukan untuk menguji perilaku runtime dan batas aktual.

## Verifikasi yang diperlukan

- Uji unit/integrasi Worker: `sha` valid diteruskan; SHA invalid ditolak; tanpa SHA payload lama tetap; upload R2 stream ukuran >8 MiB berhasil; ukuran <=8 MiB, >90 MiB, nama invalid, tanpa Content-Length, dan API key salah ditolak.
- Uji workflow dengan objek R2 nyata: pagination daftar objek, download biner, path asset, serta pastikan step render tidak memiliki `CLOUDFLARE_API_TOKEN` atau `CLOUDFLARE_ACCOUNT_ID`.
- Uji berurutan unggah asset kecil lalu `POST /render` dengan `sha=commit_sha`; periksa checkout SHA yang tepat.
- **Belum diuji tanpa Worker yang di-deploy.** PR/CI dapat memeriksa sintaks dan workflow, tetapi tidak membuktikan binding R2, token, request streaming, atau integrasi end-to-end.

## Risiko / catatan operasional

- `POST /asset` tetap memakai commit GitHub dan tidak diubah.
- Asset R2 tidak membuat commit GitHub. Bila ada nama yang sama di repo dan R2, download step menimpa file Git pada workspace render.
- Key R2 saat ini mutable. Jika asset ditimpa setelah render didispatch tetapi sebelum download step, job antrean bisa mengambil versi baru, bukan versi saat dispatch. Hindari overwrite saat render masih antre; snapshot immutable per render belum dibuat.
- Bucket `hyperframes-renders` kini berisi `renders/*` dan `assets/<composition>/*`; lifecycle cleanup harus mempertimbangkan kedua prefix.
- Worker memakai binding `VIDEOS` yang sudah ada ke bucket tersebut; tidak ada bucket atau secret baru.
