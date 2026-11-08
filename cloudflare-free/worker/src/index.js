/**
 * hyperframes-render — Cloudflare Worker (paket Workers Free).
 *
 * Peran Worker ini sengaja kecil: ia TIDAK merender apa pun. Render dilakukan
 * oleh GitHub Actions (.github/workflows/render-video.yml); Worker hanya
 *   1. menerima permintaan render (POST /render, dilindungi x-api-key),
 *   2. bila body memuat `html`: meng-commit isinya ke repo sebagai komposisi baru
 *      lewat GitHub Contents API (cloudflare-free/compositions/<nama>/index.html),
 *   2b. menerima aset biner (mis. video avatar HeyGen) lewat POST /asset dan
 *      meng-commit-nya ke cloudflare-free/compositions/<nama>/assets/<file>,
 *   3. memicu repository_dispatch (event: render-video) ke repo fork,
 *   4. menyajikan hasil MP4 dari R2 (GET /video/:id) dan statusnya (GET /status/:id),
 *      termasuk penanda gagal yang ditulis workflow (renders/<id>.failed.json),
 *   5. menyajikan halaman web (GET /) untuk memakai semuanya dari browser.
 *      Isi halaman (HTML/CSS/JS klien + header CSP) ada di ./page.js; lihat
 *      cloudflare-free/docs/UI.md untuk keputusan desainnya.
 *
 * Routing GET /:
 *   - browser (header Accept memuat text/html) -> halaman web
 *   - selain itu (curl, skrip)                 -> JSON info layanan (perilaku lama)
 *   - GET /api selalu JSON info layanan
 *
 * Binding & secret (lihat wrangler.jsonc):
 *   env.VIDEOS       R2 bucket "hyperframes-renders"
 *   env.GITHUB_REPO  var "owner/repo" tujuan commit & dispatch
 *   env.GITHUB_TOKEN secret, PAT fine-grained (Contents: Read and write)
 *   env.API_KEY      secret, kunci untuk POST /render
 *
 * Kunci objek di R2 HARUS sama dengan yang dipakai workflow:
 *   renders/<id>.mp4          hasil sukses
 *   renders/<id>.failed.json  penanda gagal/dibatalkan
 */

import { htmlPage } from "./page.js";

// Aturan input yang sama dipakai ulang di workflow (validasi dua lapis).
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
// Tautan run yang boleh diteruskan ke klien dari penanda gagal (bentuk persis dari workflow).
const RUN_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/;
const QUALITIES = new Set(["draft", "standard", "high"]);
const DEFAULT_COMPOSITION = "contoh";
// Body JSON /render. Tanpa `html` biasanya < 1 KB; dengan `html` bisa besar
// (karakter di-escape JSON), jadi batas kasarnya 1 MiB dan batas isi HTML di bawah.
const MAX_BODY_BYTES = 1024 * 1024;
// Batas isi komposisi (index.html). Dijaga kecil agar encode base64 tetap
// jauh di bawah 10 ms CPU per invocation di Workers Free.
const MAX_HTML_BYTES = 256 * 1024;
// Nama file aset (mis. assets/heygen-avatar.mp4): huruf/angka/._- , tanpa "/", maks 128 karakter.
const ASSET_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
// Batas ukuran satu aset (video avatar dsb). GitHub Contents API menerima file lebih besar,
// tetapi dijaga kecil di sini agar aman terhadap batas CPU/memori Workers Free saat decode base64.
const MAX_ASSET_BYTES = 8 * 1024 * 1024; // 8 MiB
// Body JSON /asset: base64 menambah ~37% ukuran, plus sedikit ruang untuk field lain.
const MAX_ASSET_BODY_BYTES = Math.ceil((MAX_ASSET_BYTES * 4) / 3) + 4096;

const objectKey = (id) => `renders/${id}.mp4`;
const failedKey = (id) => `renders/${id}.failed.json`;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Respons JSON (termasuk 404 "belum selesai") tidak boleh di-cache.
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

const methodNotAllowed = (allowed) =>
  json({ error: "method_not_allowed" }, 405, { allow: allowed.join(", ") });

/**
 * Bandingkan dua string tanpa membocorkan panjang/isi lewat waktu respons.
 * Keduanya di-hash SHA-256 dulu supaya panjangnya sama, lalu dibandingkan
 * dengan crypto.subtle.timingSafeEqual (tersedia di Workers runtime).
 */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/** String UTF-8 -> base64 (Contents API mewajibkan base64). */
function toBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

/** Uint8Array -> base64, per-chunk agar tidak melebihi batas argumen fromCharCode. */
function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * base64 standar -> Uint8Array. Melempar error bila bukan base64 valid
 * (termasuk base64url dengan "-"/"_", yang sengaja ditolak di sini).
 */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const githubHeaders = (env) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${env.GITHUB_TOKEN}`,
  "content-type": "application/json",
  "user-agent": "hyperframes-render-worker", // wajib untuk GitHub API
  "x-github-api-version": "2022-11-28",
});

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      // Log pesan saja; jangan pernah mencetak env/secret/header.
      console.error("unhandled", err instanceof Error ? err.message : String(err));
      return json({ error: "internal_error" }, 500);
    }
  },
};

const serviceInfo = () =>
  json(
    {
      service: "hyperframes-render",
      endpoints: ["POST /render", "POST /asset", "GET /status/:id", "GET /video/:id"],
    },
    200,
    { vary: "accept" },
  );

/** Browser mengirim Accept yang memuat text/html; curl/skrip biasanya tidak. */
const wantsHtml = (request) => (request.headers.get("accept") ?? "").includes("text/html");

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/render") {
    if (method !== "POST") return methodNotAllowed(["POST"]);
    return handleRender(request, env, url.origin);
  }

  if (pathname === "/asset") {
    if (method !== "POST") return methodNotAllowed(["POST"]);
    return handleAsset(request, env);
  }

  const match = pathname.match(/^\/(status|video)\/([^/]+)$/);
  if (match) {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    let id;
    try {
      id = decodeURIComponent(match[2]);
    } catch {
      return json({ error: "invalid_id" }, 400);
    }
    if (!ID_RE.test(id)) return json({ error: "invalid_id" }, 400);
    return match[1] === "status"
      ? handleStatus(env, id, url.origin)
      : handleVideo(request, env, id);
  }

  if (pathname === "/") {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    return wantsHtml(request) ? htmlPage() : serviceInfo();
  }

  if (pathname === "/api") {
    if (method !== "GET" && method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    return serviceInfo();
  }

  return json({ error: "not_found" }, 404);
}

/**
 * Commit cloudflare-free/compositions/<composition>/index.html ke default branch
 * lewat Contents API. Tanpa `sha` di body, GitHub menolak (422) bila file sudah
 * ada, sehingga komposisi yang sudah ada tidak pernah tertimpa.
 * Mengembalikan { ok: true, sha } atau { ok: false, status }.
 */
async function commitComposition(env, composition, html) {
  const path = `cloudflare-free/compositions/${composition}/index.html`;
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify({
      message: `chore(cloudflare-free): komposisi ${composition} dari halaman web`,
      content: toBase64(html),
    }),
  });

  if (res.status !== 201) {
    const detail = (await res.text()).slice(0, 200);
    console.error("commit_failed", res.status, detail);
    return { ok: false, status: res.status };
  }

  let sha = "";
  try {
    const data = await res.json();
    sha = data && data.commit && typeof data.commit.sha === "string" ? data.commit.sha : "";
  } catch {
    sha = "";
  }
  if (!SHA_RE.test(sha)) {
    console.error("commit_sha_missing");
    return { ok: false, status: 502 };
  }
  return { ok: true, sha };
}

/**
 * Cari sha file yang sudah ada di repo (untuk update/overwrite lewat Contents API).
 * Mengembalikan sha (string) bila file ada, atau "" bila belum ada (404) / gagal dibaca.
 */
async function getExistingSha(env, path) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: "GET",
    headers: githubHeaders(env),
  });
  if (res.status !== 200) return "";
  try {
    const data = await res.json();
    return data && typeof data.sha === "string" ? data.sha : "";
  } catch {
    return "";
  }
}

/**
 * Commit cloudflare-free/compositions/<composition>/assets/<filename> ke default branch.
 * Berbeda dari commitComposition: aset BOLEH ditimpa (upload ulang avatar yang sama),
 * jadi sha file lama (bila ada) dicari lebih dulu dan disertakan di body PUT.
 * Mengembalikan { ok: true, sha, path } atau { ok: false, status }.
 */
async function commitAsset(env, composition, filename, bytes) {
  const path = `cloudflare-free/compositions/${composition}/assets/${filename}`;
  const existingSha = await getExistingSha(env, path);

  const body = {
    message: `chore(cloudflare-free): aset ${filename} untuk komposisi ${composition}`,
    content: bytesToBase64(bytes),
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify(body),
  });

  // 201 = file baru, 200 = file ditimpa (sha disertakan).
  if (res.status !== 201 && res.status !== 200) {
    const detail = (await res.text()).slice(0, 200);
    console.error("commit_asset_failed", res.status, detail);
    return { ok: false, status: res.status };
  }

  let sha = "";
  try {
    const data = await res.json();
    sha = data && data.commit && typeof data.commit.sha === "string" ? data.commit.sha : "";
  } catch {
    sha = "";
  }
  if (!SHA_RE.test(sha)) {
    console.error("commit_asset_sha_missing");
    return { ok: false, status: 502 };
  }
  return { ok: true, sha, path };
}

/** POST /asset  body: { composition, filename, data(base64) } → 201 */
async function handleAsset(request, env) {
  if (!env.API_KEY || !env.GITHUB_TOKEN || !REPO_RE.test(env.GITHUB_REPO ?? "")) {
    return json({ error: "server_not_configured" }, 500);
  }

  const provided = request.headers.get("x-api-key") ?? "";
  if (!(await safeEqual(provided, env.API_KEY))) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_ASSET_BODY_BYTES) {
    return json({ error: "body_too_large" }, 413);
  }
  let body = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_json" }, 400);
  }

  const { composition, filename, data } = body;
  if (typeof composition !== "string" || !ID_RE.test(composition)) {
    return json({ error: "invalid_composition" }, 400);
  }
  if (typeof filename !== "string" || !ASSET_NAME_RE.test(filename)) {
    return json({ error: "invalid_filename" }, 400);
  }
  if (typeof data !== "string" || data.trim() === "") {
    return json({ error: "invalid_data" }, 400);
  }

  let bytes;
  try {
    bytes = base64ToBytes(data);
  } catch {
    return json({ error: "invalid_base64" }, 400);
  }
  if (bytes.length === 0) {
    return json({ error: "invalid_data" }, 400);
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    return json({ error: "asset_too_large", max_bytes: MAX_ASSET_BYTES }, 413);
  }

  const commit = await commitAsset(env, composition, filename, bytes);
  if (!commit.ok) {
    return json({ error: "commit_failed", github_status: commit.status }, 502);
  }

  return json(
    {
      ok: true,
      composition,
      filename,
      path: commit.path,
      src: `assets/${filename}`,
      commit_sha: commit.sha,
      bytes: bytes.length,
    },
    201,
  );
}

/** POST /render  body: { id?, composition?, quality?, html? } → 202 */
async function handleRender(request, env, origin) {
  if (!env.API_KEY || !env.GITHUB_TOKEN || !REPO_RE.test(env.GITHUB_REPO ?? "")) {
    return json({ error: "server_not_configured" }, 500);
  }

  const provided = request.headers.get("x-api-key") ?? "";
  if (!(await safeEqual(provided, env.API_KEY))) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "body_too_large" }, 413);
  }
  let body = {};
  if (raw.trim() !== "") {
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_json" }, 400);
  }

  // id otomatis berupa UUID (tak mudah ditebak) bila tidak diberikan.
  const id = body.id ?? crypto.randomUUID();
  const hasHtml = body.html !== undefined;
  // Komposisi baru dari `html` tanpa nama -> web-<id> (maks 64 karakter).
  const composition =
    body.composition ?? (hasHtml ? `web-${typeof id === "string" ? id.slice(0, 60) : ""}` : DEFAULT_COMPOSITION);
  const quality = body.quality ?? "standard";

  if (typeof id !== "string" || !ID_RE.test(id)) return json({ error: "invalid_id" }, 400);
  if (typeof composition !== "string" || !ID_RE.test(composition)) {
    return json({ error: "invalid_composition" }, 400);
  }
  if (typeof quality !== "string" || !QUALITIES.has(quality)) {
    return json({ error: "invalid_quality", allowed: [...QUALITIES] }, 400);
  }
  if (hasHtml) {
    if (typeof body.html !== "string" || body.html.trim() === "") {
      return json({ error: "invalid_html" }, 400);
    }
    if (new TextEncoder().encode(body.html).length > MAX_HTML_BYTES) {
      return json({ error: "html_too_large", max_bytes: MAX_HTML_BYTES }, 413);
    }
  }

  // Jangan menimpa hasil yang sudah ada.
  if (await env.VIDEOS.head(objectKey(id))) {
    return json({ error: "id_already_exists", id }, 409);
  }

  // Komposisi baru: commit dulu, supaya file sudah ada saat workflow checkout.
  let commitSha;
  if (hasHtml) {
    const commit = await commitComposition(env, composition, body.html);
    if (!commit.ok) {
      if (commit.status === 422) {
        return json({ error: "composition_already_exists", composition }, 409);
      }
      return json({ error: "commit_failed", github_status: commit.status }, 502);
    }
    commitSha = commit.sha;
  }

  // id yang pernah gagal boleh dipakai ulang: hapus penanda lama supaya /status
  // tidak langsung membalas "gagal" untuk render yang baru. Kegagalan di sini
  // tidak menghentikan render (penanda lama paling buruk menampilkan status usang).
  try {
    await env.VIDEOS.delete(failedKey(id));
  } catch (err) {
    console.error("clear_failed_marker", err instanceof Error ? err.message : String(err));
  }

  const clientPayload = { id, composition, quality };
  if (commitSha) clientPayload.sha = commitSha;

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({
      event_type: "render-video",
      client_payload: clientPayload,
    }),
  });

  // GitHub membalas 204 No Content bila dispatch diterima.
  if (res.status !== 204) {
    const detail = (await res.text()).slice(0, 200);
    console.error("dispatch_failed", res.status, detail);
    const failure = { error: "dispatch_failed", github_status: res.status };
    // Komposisi sudah ter-commit; beri tahu klien agar bisa mencoba lagi tanpa commit baru.
    if (commitSha) {
      failure.committed = true;
      failure.composition = composition;
    }
    return json(failure, 502);
  }

  const result = {
    id,
    composition,
    quality,
    status: "queued",
    status_url: `${origin}/status/${id}`,
    video_url: `${origin}/video/${id}`,
  };
  if (commitSha) {
    result.committed = true;
    result.commit_sha = commitSha;
  }
  return json(result, 202);
}

/**
 * Baca penanda gagal yang ditulis workflow. Hanya field yang dikenal yang
 * diteruskan, dan run_url harus cocok bentuk tautan run GitHub.
 * Mengembalikan { reason, run_url? } atau null bila tidak ada.
 */
async function readFailure(env, id) {
  const obj = await env.VIDEOS.get(failedKey(id));
  if (!obj) return null;
  let data = null;
  try {
    data = JSON.parse(await obj.text());
  } catch {
    data = null;
  }
  const failure = { reason: data && data.reason === "cancelled" ? "cancelled" : "failed" };
  if (data && typeof data.run_url === "string" && RUN_URL_RE.test(data.run_url)) {
    failure.run_url = data.run_url;
  }
  return failure;
}

/**
 * GET /status/:id
 *   200 {status:"done"}    MP4 ada di R2
 *   410 {status:"failed"}  workflow menulis penanda gagal/dibatalkan
 *   404 {status:"not_ready"} selain itu (antre/render/id tak dikenal tidak dibedakan)
 */
async function handleStatus(env, id, origin) {
  const head = await env.VIDEOS.head(objectKey(id));
  if (head) {
    // MP4 selalu menang atas penanda gagal lama (mis. id dipakai ulang).
    return json({
      id,
      status: "done",
      size: head.size,
      uploaded: head.uploaded.toISOString(),
      video_url: `${origin}/video/${id}`,
    });
  }

  const failure = await readFailure(env, id);
  if (failure) {
    const body = { id, status: "failed", reason: failure.reason };
    if (failure.run_url) body.run_url = failure.run_url;
    return json(body, 410);
  }

  return json({ id, status: "not_ready" }, 404);
}

/** GET|HEAD /video/:id — sajikan MP4 dari R2 (404 selama belum selesai). */
async function handleVideo(request, env, id) {
  const key = objectKey(id);
  const isHead = request.method === "HEAD";

  // `range: request.headers` membuat R2 menangani header Range sehingga
  // pemutar video bisa seek (respons 206).
  const object = isHead
    ? await env.VIDEOS.head(key)
    : await env.VIDEOS.get(key, { range: request.headers });
  if (!object) return json({ id, error: "not_ready" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-type", "video/mp4");
  headers.set("accept-ranges", "bytes");
  // id tidak pernah ditimpa lewat API (409), jadi aman di-cache sejam.
  headers.set("cache-control", "public, max-age=3600");

  if (isHead) {
    headers.set("content-length", String(object.size));
    return new Response(null, { status: 200, headers });
  }

  let status = 200;
  if (object.range) {
    status = 206;
    headers.set("content-range", contentRange(object.range, object.size));
  }
  return new Response(object.body, { status, headers });
}

/** Bangun header Content-Range dari R2Range (offset/length atau suffix). */
function contentRange(range, size) {
  let start;
  let end;
  if (range.suffix !== undefined) {
    start = Math.max(size - range.suffix, 0);
    end = size - 1;
  } else {
    start = range.offset ?? 0;
    end = range.length !== undefined ? Math.min(start + range.length, size) - 1 : size - 1;
  }
  return `bytes ${start}-${end}/${size}`;
}
