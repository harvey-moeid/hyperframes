# HyperFrames Render API & asset workflow

Worker: `hyperframes-render`  
Base URL: `https://hyperframes-render.harveymoeid.workers.dev`

Halaman web dan REST API memakai Worker, bucket R2, serta workflow GitHub Actions yang sama. Worker memvalidasi dan menerima permintaan; GitHub Actions menjalankan HyperFrames/Chrome/FFmpeg; MP4 disimpan di R2.

## Web

1. Buka URL Worker di browser.
2. Masukkan API key di Pengaturan.
3. Buka Media, pilih komposisi, lalu unggah gambar, audio, atau video.
   - Sampai 8 MiB: dikirim ke endpoint `POST /asset` dan disimpan sebagai file komposisi di GitHub.
   - Di atas 8 MiB sampai 90 MiB: dikirim sebagai stream ke R2 melalui `PUT /asset-large/:composition/:filename`.
4. Buka Buat video, pilih komposisi yang sama, pilih kualitas, lalu Mulai render.
5. Render Center menampilkan status dan hasil MP4.

Unggahan dari halaman web diproses berurutan agar commit aset kecil di GitHub tidak saling balapan. SHA commit terakhir untuk komposisi otomatis dipakai saat render.

## REST API

Semua endpoint yang mengubah data memerlukan header `x-api-key`. Jangan menaruh API key di HTML komposisi atau URL.

### Upload aset kecil (maksimum 8 MiB)

```http
POST /asset
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "composition": "promo",
  "filename": "cover.png",
  "data": "BASE64_STANDARD"
}
```

Balasan `201` menyertakan `commit_sha`. Simpan SHA terbaru untuk komposisi tersebut dan kirim sebagai `sha` saat membuat render agar GitHub Actions checkout versi komposisi dan aset yang sama.

### Upload aset besar (lebih dari 8 MiB sampai 90 MiB)

```http
PUT /asset-large/promo/intro.mp4
Content-Type: video/mp4
Content-Length: 12582912
x-api-key: YOUR_API_KEY

<raw binary body>
```

Endpoint ini memerlukan Content-Length yang valid. Aset besar disimpan di R2 dan Worker membuat snapshot immutable per render sebelum dispatch.

### Mulai render

```http
POST /render
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "composition": "promo",
  "quality": "standard",
  "sha": "40_CHARACTER_GIT_COMMIT_SHA"
}
```

Field:
- `composition`: nama folder komposisi, huruf/angka/`_`/`-`, maksimum 64 karakter. Opsional; default `contoh`.
- `quality`: `draft`, `standard`, atau `high`.
- `id`: opsional; ID hanya boleh digunakan satu kali. Jika kosong, Worker membuat UUID acak.
- `sha`: opsional untuk komposisi/aset GitHub yang sudah ada; gunakan `commit_sha` terbaru dari upload aset.
- `html`: opsional, HTML komposisi baru maksimum 256 KiB.

Balasan `202` memuat `id`, `status_url`, `video_url`, dan jumlah/ukuran aset R2 yang disnapshot. ID render yang sudah pernah dipesan menghasilkan `409 id_already_exists`; gunakan ID baru untuk render ulang. Ini mencegah dua workflow menimpa output dengan ID yang sama.

### Status dan hasil

- `GET /status/:id`: status hasil; `200 done`, `410 failed`, `404 not_ready`.
- `GET /video/:id`: MP4 dengan dukungan byte-range untuk seek.

Endpoint video dan status saat ini tetap dapat diakses tanpa API key; perlakukan URL/ID render sebagai tautan yang dapat dibagikan. Jangan gunakan ID pendek atau mudah ditebak bila memanggil API secara langsung.

## Snapshot aset

- Aset GitHub dipatok ke commit SHA yang dikirim pada render.
- Aset besar R2 disalin ke `render-assets/<render-id>/` sebelum GitHub Actions dipicu.
- Workflow repository-dispatch menggunakan snapshot tersebut, bukan key upload yang bisa ditimpa.
- Snapshot dipertahankan di R2 untuk memungkinkan rerun workflow; bersihkan sesuai kebijakan retensi bucket setelah tidak diperlukan.

## Batasan operasional

- Maksimum 100 aset R2 per komposisi per render dan 500 MiB total snapshot.
- Setiap file besar maksimum 90 MiB.
- HTML komposisi maksimum 256 KiB.
- Render berat dijalankan oleh GitHub Actions, bukan di dalam Worker.
- Perubahan branch/PR tidak otomatis mengubah Worker production. Deploy production memerlukan persetujuan terpisah.
