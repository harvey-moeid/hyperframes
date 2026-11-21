/**
 * Entry Worker "hyperframes-render" (dipakai wrangler.jsonc: "main").
 *
 * Membungkus aplikasi inti (./index.js, tidak diubah) dengan lapisan PWA (./pwa/index.js):
 *   - melayani /manifest.webmanifest, /sw.js, /icon.svg, dan /icons/icon-{192,512}.png
 *   - pada halaman web (GET /): menyisipkan tag manifest, CSS, dan skrip PWA, serta menambah
 *     manifest-src dan worker-src 'self' ke CSP. Respons lain (API, video, status) tidak disentuh.
 *   - melayani GET /renders (./renders.js): daftar render dari R2 untuk sinkronisasi riwayat
 *     di halaman web. Dilindungi x-api-key.
 *   - melayani POST /transcribe dan GET /transcript/:id (./transcribe.js): transkripsi audio
 *     berwaktu per kata lewat GitHub Actions. Dilindungi x-api-key.
 *
 * Mengembalikan "main" di wrangler.jsonc ke src/index.js menghapus PWA, /renders, dan transkripsi tanpa efek samping lain.
 */

import app from "./index.js";
import { decorateShell, pwaResponse } from "./pwa/index.js";
import { handleRenders } from "./renders.js";
import { handleTranscribe, handleTranscript } from "./transcribe.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === "/renders") return handleRenders(request, env);
    if (pathname === "/transcribe") return handleTranscribe(request, env, url.origin);
    const transcriptMatch = pathname.match(/^\/transcript\/([^/]+)$/);
    if (transcriptMatch) {
      let id;
      try {
        id = decodeURIComponent(transcriptMatch[1]);
      } catch {
        return new Response(JSON.stringify({ error: "invalid_id" }), {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return handleTranscript(request, env, id);
    }
    const own = pwaResponse(pathname, request.method);
    if (own) return own;
    const res = await app.fetch(request, env, ctx);
    return decorateShell(request, res);
  },
};
