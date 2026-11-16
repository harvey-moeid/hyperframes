/**
 * Entry Worker "hyperframes-render" (dipakai wrangler.jsonc: "main").
 *
 * Membungkus aplikasi inti (./index.js, tidak diubah) dengan lapisan PWA (./pwa/index.js):
 *   - melayani /manifest.webmanifest, /sw.js, /icon.svg, dan /icons/icon-{192,512}.png
 *   - pada halaman web (GET /): menyisipkan tag manifest, CSS, dan skrip PWA, serta menambah
 *     manifest-src dan worker-src 'self' ke CSP. Respons lain (API, video, status) tidak disentuh.
 *   - melayani GET /renders (./renders.js): daftar render dari R2 untuk sinkronisasi riwayat
 *     di halaman web. Dilindungi x-api-key.
 *
 * Mengembalikan "main" di wrangler.jsonc ke src/index.js menghapus PWA dan /renders tanpa efek samping lain.
 */

import app from "./index.js";
import { decorateShell, pwaResponse } from "./pwa/index.js";
import { handleRenders } from "./renders.js";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/renders") return handleRenders(request, env);
    const own = pwaResponse(pathname, request.method);
    if (own) return own;
    const res = await app.fetch(request, env, ctx);
    return decorateShell(request, res);
  },
};
