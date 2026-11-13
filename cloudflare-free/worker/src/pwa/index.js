/**
 * Lapisan PWA HyperFrames Studio, dipakai oleh ../worker.js.
 *
 *  - pwaResponse(pathname, method): melayani aset PWA milik sendiri (manifest, service worker, ikon).
 *    Mengembalikan null untuk path lain, sehingga permintaan diteruskan ke aplikasi inti.
 *  - decorateShell(request, res): hanya untuk GET "/" yang menghasilkan HTML 200. Menyisipkan tag
 *    manifest, CSS, dan skrip klien PWA memakai nonce CSP yang sudah ada di respons, lalu menambah
 *    manifest-src dan worker-src 'self' ke CSP (default-src 'none' memblokir keduanya).
 *    Respons lain (JSON info layanan, API, video, status) dikembalikan apa adanya.
 *
 * KEPUTUSAN:
 *  - Ikon divalidasi (CRC + ukuran) sekali per isolate; bila rusak dipakai PNG polos buatan kode,
 *    jadi manifest tidak pernah menunjuk ikon rusak.
 *  - /sw.js dikirim no-cache agar versi baru service worker cepat terdeteksi.
 *  - Bila HTML tidak punya </head> atau </body>, atau tidak ada nonce di CSP, respons asli dikembalikan
 *    tanpa diubah: PWA mati, aplikasi inti tetap jalan.
 */

import { SW_SOURCE } from "./service-worker.js";
import { HEAD_TAGS, CLIENT_CSS, CLIENT_SOURCE } from "./client.js";
import { ICON_192_B64, ICON_512_B64, ICON_SVG } from "./icons.js";
import { base64ToBytes, isValidPng, solidPng } from "./png.js";

const BRAND_RGB = [0x24, 0x6b, 0xfd];
const BG_COLOR = "#080D19";

const MANIFEST = JSON.stringify({
  id: "/",
  name: "HyperFrames Studio",
  short_name: "HyperFrames",
  description: "Studio render video HyperFrames di Cloudflare Free dan GitHub Actions.",
  lang: "id",
  dir: "ltr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: BG_COLOR,
  theme_color: BG_COLOR,
  categories: ["productivity", "multimedia"],
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
});

const iconCache = new Map();
function iconBytes(size) {
  let bytes = iconCache.get(size);
  if (bytes) return bytes;
  try {
    bytes = base64ToBytes(size === 192 ? ICON_192_B64 : ICON_512_B64);
    if (!isValidPng(bytes, size)) bytes = null;
  } catch {
    bytes = null;
  }
  if (!bytes) bytes = solidPng(size, BRAND_RGB);
  iconCache.set(size, bytes);
  return bytes;
}

function asset(body, contentType, cacheControl, extra) {
  return {
    body,
    headers: Object.assign(
      {
        "content-type": contentType,
        "cache-control": cacheControl,
        "x-content-type-options": "nosniff",
      },
      extra || {},
    ),
  };
}

function lookup(pathname) {
  switch (pathname) {
    case "/manifest.webmanifest":
      return asset(MANIFEST, "application/manifest+json; charset=utf-8", "no-cache");
    case "/sw.js":
      return asset(SW_SOURCE, "text/javascript; charset=utf-8", "no-cache", { "service-worker-allowed": "/" });
    case "/icon.svg":
      return asset(ICON_SVG, "image/svg+xml; charset=utf-8", "public, max-age=86400");
    case "/icons/icon-192.png":
      return asset(iconBytes(192), "image/png", "public, max-age=86400");
    case "/icons/icon-512.png":
      return asset(iconBytes(512), "image/png", "public, max-age=86400");
    default:
      return null;
  }
}

export function pwaResponse(pathname, method) {
  if (method !== "GET" && method !== "HEAD") return null;
  const hit = lookup(pathname);
  if (!hit) return null;
  return new Response(method === "HEAD" ? null : hit.body, { status: 200, headers: hit.headers });
}

function withPwaCsp(csp) {
  let out = csp.replace(/[;\s]+$/, "");
  if (!/(^|;)\s*manifest-src\s/.test(out)) out += "; manifest-src 'self'";
  if (!/(^|;)\s*worker-src\s/.test(out)) out += "; worker-src 'self'";
  return out;
}

export async function decorateShell(request, res) {
  try {
    if (request.method !== "GET") return res;
    if (new URL(request.url).pathname !== "/") return res;
    if (res.status !== 200) return res;
    if ((res.headers.get("content-type") || "").indexOf("text/html") < 0) return res;

    const csp = res.headers.get("content-security-policy") || "";
    const match = /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(csp);
    if (!match) return res;
    const nonce = match[1];

    // Salinan dibaca; respons asli tetap utuh bila penyisipan tidak mungkin.
    const html = await res.clone().text();
    const headAt = html.indexOf("</head>");
    const bodyAt = html.lastIndexOf("</body>");
    if (headAt < 0 || bodyAt < headAt) return res;

    const out =
      html.slice(0, headAt) +
      HEAD_TAGS +
      '<style nonce="' + nonce + '">' + CLIENT_CSS + "</style>" +
      html.slice(headAt, bodyAt) +
      '<script nonce="' + nonce + '">' + CLIENT_SOURCE + "</script>" +
      html.slice(bodyAt);

    const headers = new Headers(res.headers);
    headers.set("content-security-policy", withPwaCsp(csp));
    headers.delete("content-length");
    return new Response(out, { status: res.status, statusText: res.statusText, headers });
  } catch {
    return res;
  }
}
