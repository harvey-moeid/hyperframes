/**
 * Entry Worker "hyperframes-render" (dipakai wrangler.jsonc: "main").
 *
 * Membungkus aplikasi inti (./index.js, tidak diubah) dengan lapisan PWA (./pwa/index.js):
 *   - melayani /manifest.webmanifest, /sw.js, /icon.svg, dan /icons/icon-{192,512}.png
 *   - pada halaman web (GET /): menyisipkan tag manifest, CSS, dan skrip PWA, serta menambah
 *     manifest-src dan worker-src 'self' ke CSP. Respons lain (API, video, status) tidak disentuh.
 *
 * Mengembalikan "main" di wrangler.jsonc ke src/index.js menghapus PWA tanpa efek samping lain.
 */

import app from "./index.js";
import { decorateShell, pwaResponse } from "./pwa/index.js";

export default {
  async fetch(request, env, ctx) {
    const own = pwaResponse(new URL(request.url).pathname, request.method);
    if (own) return own;
    const res = await app.fetch(request, env, ctx);
    return decorateShell(request, res);
  },
};
