# Transkripsi audio (kata berwaktu)

Untuk menyinkronkan gambar, teks, dan animasi dengan suara, dibutuhkan waktu mulai tiap kata.
`POST /transcribe` memicu workflow `.github/workflows/transcribe-audio.yml` yang menjalankan
`npx hyperframes transcribe` (whisper) di runner, lalu menyimpan hasilnya ke R2. Worker tidak
mentranskripsi apa pun (batas CPU 10 ms Workers Free); kode ada di `worker/src/transcribe.js`.

| Endpoint              | Auth               | Keterangan                                                                                                                                                                      |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /transcribe`    | header `x-api-key` | Body JSON: `composition` dan `filename` (wajib), `id`, `language` (default `id`), `model` (default `small`), `sha`. Balas `202`.                                                |
| `GET /transcript/:id` | header `x-api-key` | `200` isi hasil · `410 {status:"failed", reason, run_url?}` · `404 {status:"not_ready"}`. Dilindungi x-api-key karena memuat isi ucapan (berbeda dengan `/status` yang publik). |

- Audio harus sudah diunggah lebih dulu (`POST /asset` atau `PUT /asset-large/...`) dan dirujuk lewat
  `composition` + `filename`. Ekstensi yang diterima: wav, mp3, m4a, aac, ogg, flac, mp4, webm, mov.
- Workflow mengambil audio dari Git (checkout sparse); bila tidak ada, dari R2 `assets/<composition>/<filename>`.
- `model`: `tiny.en`, `base.en`, `small.en`, `medium.en`, `small`, `medium`, `large-v3`. Untuk bahasa selain
  Inggris pakai model tanpa `.en` dan isi `language` (mis. `id`); model `.en` dan default CLI (`small.en`)
  menerjemahkan ke Inggris.
- Hasil di R2: `transcripts/<id>.json` (sukses) dan `transcripts/<id>.failed.json` (gagal/dibatalkan).
  `POST /transcribe` dengan `id` yang pernah gagal menghapus penanda lamanya; `id` yang sudah punya hasil
  dibalas `409 id_already_exists`.
- Bentuk hasil: `{id, status:"done", composition, filename, language, model, duration, word_count,
  transcribed_at, words:[{id, text, start, end}]}`; `start`/`end` dalam detik. Pakai `start` kata kunci
  sebagai `data-start` dan posisi tween di komposisi.
- Seperti render, `repository_dispatch` hanya berjalan dari workflow di default branch.

```bash
curl -sS -X POST "$WORKER/transcribe" -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"id":"tr1","composition":"kontenbyga1","filename":"suara-9a28a5cf.wav","language":"id","model":"small"}'
curl -sS -H "x-api-key: $API_KEY" "$WORKER/transcript/tr1"
```
