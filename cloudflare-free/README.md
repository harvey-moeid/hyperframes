# cloudflare-free — render HyperFrames 100% di paket gratis

Layanan render video tanpa server berbayar: **Cloudflare Workers Free** (API) +
**R2 free tier** (penyimpanan) + **GitHub Actions** (mesin render, FFmpeg + Chrome).
Tidak memakai Workers Paid, Containers, Sandbox, maupun Browser Rendering.
Kode inti di `packages/` tidak diubah.

## Arsitektur

```
client ── POST /render (x-api-key) ──▶ Worker (Free)
                                        │ (bila body memuat `html`) PUT Contents API:
                                        │   compositions/<nama>/index.html  → commit di default branch
                                        │ repository_dispatch (event: render-video, + sha commit)
                                        ▼
                              GitHub Actions: render-video.yml
                              Node 22 + FFmpeg → `npx hyperframes render`
                                        │ wrangler r2 object put --remote
                                        ▼
                              R2 bucket `hyperframes-renders`
                                renders/<id>.mp4          (sukses)
                                renders/<id>.failed.json  (gagal / dibatalkan)
                                        ▲
client ◀── GET /video/:id, /status/:id ─┘ (lewat Worker)
        /status: 200 selesai · 410 gagal · 404 belum ada
```

## Isi folder

| Path | Fungsi |
| --- | --- |
| `worker/src/index.js` | Worker: halaman web `/`, `/api`, `/render`, `/status/:id`, `/video/:id` |
| `worker/wrangler.jsonc` | Binding R2 `VIDEOS`, var `GITHUB_REPO` |
| `compositions/contoh/` | Komposisi contoh 5 detik (1920×1080) |
| `../.github/workflows/render-video.yml` | Workflow render (dipicu `repository_dispatch` / manual) |
| `../.github/workflows/deploy-worker.yml` | Workflow deploy Worker (manual, `wrangler deploy`) |

Komposisi baru bisa dibuat dua cara:

1. **Manual**: buat folder `compositions/<nama>/index.html` (format HyperFrames: root dengan
   `data-composition-id`, timeline GSAP `paused` yang didaftarkan di `window.__timelines`).
2. **Lewat Worker**: kirim isinya di field `html` (atau tempel di halaman web; tombol
   *Isi dari contoh* memuat templat awal). Worker yang meng-commit file yang sama ke repo,
   lalu memicu render.

Nama folder harus cocok `^[a-zA-Z0-9_-]{1,64}$`.

> Templat di tombol *Isi dari contoh* adalah salinan `compositions/contoh/index.html` yang tertanam
> di `worker/src/index.js` (konstanta `COMPOSITION_TEMPLATE`, beda satu komentar tanpa backtick).
> Bila `contoh` diubah, perbarui konstanta itu juga.

## API

| Endpoint | Auth | Keterangan |
| --- | --- | --- |
| `GET /` | — | Browser (header `Accept` memuat `text/html`) → halaman web. Selain itu (curl, skrip) → JSON info layanan, sama seperti sebelumnya. |
| `GET /api` | — | Selalu JSON info layanan. |
| `POST /render` | header `x-api-key` | Body JSON opsional: `id`, `composition` (default `contoh`), `quality` (`draft`/`standard`/`high`), `html`. `id` kosong → UUID otomatis. Balas `202`. `409` bila `id` sudah ada. Lihat bagian *Komposisi lewat `html`*. |
| `GET /status/:id` | — | `200 {status:"done"}` bila MP4 ada di R2; `410 {status:"failed", reason, run_url?}` bila workflow menandai render gagal/dibatalkan; selain itu `404 {status:"not_ready"}` (antre/render/id tak dikenal tidak dibedakan). |
| `GET /video/:id` | — | Menyajikan MP4 (mendukung Range). `404` selama belum selesai. |

Karena `/status` dan `/video` publik, pakai `id` yang sulit ditebak (biarkan UUID otomatis).

### Status gagal (`410`)

Bila job di Actions gagal atau dibatalkan, step terakhir workflow menulis `renders/<id>.failed.json`
ke R2 (`{status, reason: "failure"|"cancelled", run_url, failed_at}`). Worker membacanya:

- `GET /status/:id` → `410 {id, status:"failed", reason:"failed"|"cancelled", run_url}`. `run_url` hanya
  diteruskan bila berbentuk `https://github.com/<owner>/<repo>/actions/runs/<angka>`.
- Hasil MP4 selalu menang: bila `renders/<id>.mp4` ada, `/status` membalas `200` walau penanda lama masih ada.
- `POST /render` dengan `id` yang pernah gagal menghapus penanda lamanya lebih dulu, jadi `id` boleh dipakai ulang
  (kecuali komposisi `web-<id>`-nya sudah ada; lihat *Pemecahan masalah*).
- Skrip yang menunggu `200` dengan polling sebaiknya berhenti juga saat menerima `410`.
- Penanda **tidak** ditulis bila id tidak valid, secret Cloudflare belum diset, atau runner mati mendadak
  sebelum step penanda jalan; dalam kasus itu `/status` tetap `404` dan halaman web menyerah setelah 35 menit.
- Dispatch manual (*Run workflow*) tidak menghapus penanda lama; bila `id` yang sama pernah gagal, `/status`
  tetap `410` sampai MP4 baru ada. Pakai `id` baru untuk tes manual.

### Komposisi lewat `html`

Bila body `POST /render` memuat `html` (string isi `index.html`):

- Worker meng-commit `cloudflare-free/compositions/<composition>/index.html` ke **default branch**
  lewat GitHub Contents API, lalu memicu render dengan `sha` commit itu (workflow checkout persis SHA tsb).
- `composition` opsional; kosong → `web-<id>` (id dipotong 60 karakter).
- File yang sudah ada **tidak pernah ditimpa**: balasan `409 {error:"composition_already_exists"}`.
- Batas isi: 256 KB (`MAX_HTML_BYTES` di Worker; dijaga kecil karena batas 10 ms CPU Workers Free).
  Lebih besar → `413 html_too_large`; kosong atau bukan string → `400 invalid_html`.
- Commit gagal → `502 {error:"commit_failed", github_status}`. Commit sukses tetapi dispatch gagal →
  `502 {error:"dispatch_failed", committed:true, composition}`; komposisi tetap ada di repo dan bisa
  dirender ulang tanpa `html`.
- Balasan sukses ikut memuat `committed:true` dan `commit_sha`.
- **Setiap render dengan `html` menambah satu commit di repo.** Tidak ada batas ukuran praktis di
  repo, tetapi riwayat git akan terus bertambah.

## Halaman web

Buka `https://hyperframes-render.<SUBDOMAIN-ANDA>.workers.dev/` di browser. Fungsinya:

- Form render: API key, sumber komposisi, kualitas, dan ID opsional → memanggil `POST /render`.
  Sumber komposisi: *yang sudah ada di repo* (nama folder) atau *tulis komposisi baru* (nama opsional +
  textarea `index.html`, di-commit Worker ke repo). Tombol *Isi dari contoh* mengisi textarea dengan templat
  komposisi 5 detik (meminta konfirmasi bila textarea sudah berisi).
- Memantau `/status/:id` otomatis (4 dtk, melambat ke 8 dtk setelah 2 menit dan 15 dtk setelah 10 menit),
  lalu memutar video dan menyediakan tombol unduh serta salin tautan.
- Bila `/status` membalas `410`, halaman langsung menampilkan **Gagal** (atau **Dibatalkan**) dan tombol
  *Buka log di GitHub*. Tanpa penanda, halaman berhenti sendiri setelah 35 menit (workflow dibatasi 30 menit).
- Riwayat 12 render terakhir (status: diproses, selesai, gagal, tidak selesai) disimpan di `localStorage`
  perangkat itu saja. Halaman bisa dibuka langsung ke satu hasil lewat `/?id=<id>` (tanpa API key).
  Isi textarea komposisi tidak disimpan.
- API key hanya dikirim sebagai header `x-api-key`. Opsi "ingat" memakai `sessionStorage` (hilang saat
  tab ditutup); tanpa opsi itu, key tidak disimpan sama sekali.
- Satu file tanpa dependensi eksternal. Script dan style inline dilindungi CSP dengan nonce acak per
  respons (`default-src 'none'`), plus `X-Frame-Options: DENY`, `nosniff`, dan `Referrer-Policy: no-referrer`.
  CSP ini juga memblokir atribut `style="..."`, jadi semua gaya memakai class di blok `<style>`.

Perilaku API untuk `curl`/skrip tidak berubah: `GET /` tanpa `Accept: text/html` tetap membalas JSON.

## Setup

1. Bucket: `npx wrangler r2 bucket create hyperframes-renders`
2. GitHub Secrets (Settings → Secrets and variables → Actions):
   `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`.
   Izin token: *Account → Workers Scripts: Edit* dan *Workers R2 Storage: Edit*.
3. **Aktifkan Actions di fork**: GitHub menonaktifkan workflow di fork secara default.
   Buka tab *Actions* → *I understand my workflows, go ahead and enable them*.
4. Deploy Worker: Actions → *Deploy worker* → *Run workflow*
   (alternatif lokal: `cd cloudflare-free/worker && npx wrangler deploy`).
5. Secret runtime Worker (nilai diketik di prompt, jangan ditulis ke file):
   `npx wrangler secret put GITHUB_TOKEN` dan `npx wrangler secret put API_KEY`
   - `GITHUB_TOKEN`: PAT *fine-grained*, hanya untuk repo fork ini, izin **Contents: Read and write**
     (dibutuhkan endpoint `repository_dispatch` **dan** commit komposisi lewat Contents API).
   - `API_KEY`: string acak buatan sendiri, mis. `openssl rand -hex 32`.
6. Tes cepat tanpa Worker: Actions → *Render video* → *Run workflow* (`id=tes1`).

## Pemakaian

```bash
WORKER=https://hyperframes-render.<SUBDOMAIN-ANDA>.workers.dev

# 1. minta render (API_KEY = nilai secret API_KEY, simpan di variabel lingkungan)
curl -sS -X POST "$WORKER/render" \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"composition":"contoh","quality":"draft"}'

# 1b. atau kirim komposisi baru dari file lokal (jq membuat JSON dan meng-escape isinya)
jq -n --rawfile html komposisi.html '{html:$html, composition:"video-baru", quality:"draft"}' |
  curl -sS -X POST "$WORKER/render" \
    -H "x-api-key: $API_KEY" -H "content-type: application/json" -d @-

# 2. cek status (ulangi sampai 200 "done"; berhenti juga bila 410 "failed")
curl -sS -w '\nHTTP %{http_code}\n' "$WORKER/status/<id>"

# 3. unduh hasil
curl -sS -o hasil.mp4 "$WORKER/video/<id>"
```

Atau cukup buka `$WORKER/` di browser (lihat *Halaman web*).

## Batas gratis (perkiraan, cek halaman harga resmi)

- **Workers Free**: 100.000 request/hari, 10 ms CPU per invocation. Satu render = 1 request `/render` + beberapa polling.
- **R2 free tier**: 10 GB-bulan penyimpanan, 1 juta operasi Class A (tulis) dan 10 juta Class B (baca) per bulan, egress gratis. Satu render ≈ 1 tulis; `/video` ≈ 1 baca per panggilan; `/status` ≈ 1–2 baca per panggilan (cek MP4, lalu cek penanda gagal selama belum selesai).
- **GitHub Actions**: repo publik memakai runner standar tanpa kuota menit (menurut dokumentasi GitHub); repo privat dibatasi kuota menit akun. Job dibatasi `timeout-minutes: 30`.
- **GitHub API**: tiap render dengan `html` = 1 commit + 1 dispatch; masih jauh di bawah batas rate API.
- Batas teknis workflow: MP4 maksimal 300 MiB (guard di workflow); durasi/resolusi besar = render lebih lama di runner 4 vCPU.
- Isi komposisi lewat `html`: maks 256 KB per permintaan.
- R2 tidak menghapus otomatis: hapus `renders/*.mp4` dan `renders/*.failed.json` lama bila mendekati 10 GB (atau pasang lifecycle rule di dashboard; penanda gagal hanya beberapa ratus byte).

## Keamanan

- Tidak ada token/API key di repo. Rahasia hanya di Worker secrets dan GitHub Secrets.
- Input `id`/`composition`/`quality` divalidasi di Worker **dan** di workflow; di workflow input dilewatkan lewat `env:`, tidak diinterpolasi ke shell.
- Bandingkan `x-api-key` dengan `crypto.subtle.timingSafeEqual`.
- Versi CLI (`hyperframes`, `wrangler`) dan SHA action dipin di workflow; naikkan secara sadar.
- Fork publik: siapa pun bisa membaca workflow, tetapi tanpa `GITHUB_TOKEN` Worker tidak ada yang bisa memicu dispatch.
- Halaman web: CSP berbasis nonce, data dari server hanya dimasukkan ke DOM lewat `textContent`, ID dari server maupun `localStorage` divalidasi ulang dengan regex yang sama sebelum dipakai.
- Penanda gagal: hanya field yang dikenal yang diteruskan Worker ke klien, dan `run_url` divalidasi dengan regex bentuk tautan run GitHub (Worker **dan** halaman web) sebelum dijadikan tautan; tautan dibuka dengan `rel="noopener noreferrer"`.
- Komposisi lewat `html`: path commit selalu `cloudflare-free/compositions/<nama>/index.html` dengan `<nama>` lolos regex (tidak bisa keluar folder atau menyentuh `.github/`), dan file lama tidak ditimpa.
- **Isi komposisi dijalankan sebagai kode** (HTML/JS) di Chrome pada runner GitHub Actions. Secret Cloudflare hanya dipasang di step *Upload ke R2* dan step penanda gagal (keduanya setelah render), tidak di step render. Pelindung utamanya tetap `x-api-key`: siapa pun yang memegangnya bisa menjalankan kode di runner dan menambah commit di repo, jadi jaga kerahasiaannya.

## Pemecahan masalah

- Dispatch `502`/`github_status: 404`: token salah atau tidak punya akses ke repo; `403`: izin Contents belum *write*.
- `502 commit_failed` dengan `github_status` 404/403/401: sebab sama seperti dispatch (token/izin Contents). `409`: ada commit lain bersamaan, ulangi.
- `409 composition_already_exists`: nama komposisi sudah ada di repo; kosongkan nama (otomatis `web-<id>`) atau pilih nama lain. Ini juga terjadi bila mengulang `id` yang sama dengan `html` setelah render gagal (komposisi `web-<id>` sudah ter-commit): ulangi dengan `id` baru, atau jalankan ulang tanpa `html` memakai `composition: "web-<id>"`.
- `/status` `410` (gagal): buka `run_url` / log workflow *Render video*; step *Render komposisi* biasanya memuat hasil `hyperframes lint` atau error render.
- `/status` tetap `404` lama padahal workflow sudah merah: penanda gagal tidak tertulis. Periksa step *Tulis penanda gagal ke R2* di log (secret Cloudflare belum diset atau izin R2 kurang).
- Workflow tidak jalan: Actions belum diaktifkan di fork, atau workflow belum ada di default branch.
- Checkout gagal pada render komposisi baru: workflow lama (tanpa `ref` dari `client_payload.sha`) masih di `main`; merge PR yang memuat perubahan workflow.
- Deploy gagal `Authentication error`: izin *Workers Scripts: Edit* belum ada di `CLOUDFLARE_API_TOKEN`.
- Render gagal: lihat step *hyperframes doctor* dan *Render komposisi* di log; jalankan `npx hyperframes lint` lokal pada komposisinya.
- Upload R2 gagal: periksa dua GitHub Secrets Cloudflare dan nama bucket.
- Halaman web tidak muncul dan hanya JSON: Worker lama belum di-deploy ulang, atau klien tidak mengirim `Accept: text/html`.
