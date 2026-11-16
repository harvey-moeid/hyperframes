/**
 * GET /renders — daftar render dari R2 untuk sinkronisasi riwayat lintas perangkat.
 *
 * KEPUTUSAN:
 *  - Sumber kebenaran = objek di bucket R2 yang sama dengan /status dan /video:
 *      renders/<id>.mp4          render sukses
 *      renders/<id>.failed.json  render gagal/dibatalkan (ditulis workflow)
 *      renders/<id>.meta.json    {composition, quality} (ditulis workflow; opsional)
 *    Render yang masih antre/berjalan belum punya objek, jadi tidak muncul di sini.
 *  - Dilindungi x-api-key. /status dan /video publik karena id berupa UUID yang sulit ditebak;
 *    daftar ini membuka SEMUA id, jadi tidak boleh publik.
 *  - Batas Workers Free: 50 subrequest per invocation. R2 list maks MAX_LIST_PAGES kali dan
 *    pembacaan JSON maks MAX_LIMIT kali (satu per baris), total < 50.
 *  - R2 list berurutan menurut nama kunci, bukan waktu. Bila lebih dari MAX_LIST_PAGES halaman,
 *    hasil diurutkan dari subset yang terbaca saja dan `truncated: true` dikembalikan.
 *
 * Respons: { renders: [{ id, status: "done"|"failed", uploaded, size?, reason?, run_url?, composition?, quality? }],
 *            truncated: boolean }
 */

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const RUN_URL_RE =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/;
const QUALITIES = new Set(["draft", "standard", "high"]);
const KEY_RE = /^renders\/([a-zA-Z0-9_-]{1,64})\.(mp4|failed\.json|meta\.json)$/;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 40;
const MAX_LIST_PAGES = 5;
const MAX_JSON_BYTES = 4096;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

/** Bandingkan dua string tanpa membocorkan panjang/isi lewat waktu respons (sama dengan index.js). */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function parseLimit(raw) {
  if (raw === null || !/^[0-9]{1,3}$/.test(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Number(raw), 1), MAX_LIMIT);
}

/** Kelompokkan objek renders/ per id: { mp4?, failed?, meta? }. */
async function listRenderObjects(bucket) {
  const byId = new Map();
  let cursor;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const res = await bucket.list({ prefix: "renders/", cursor, limit: 1000 });
    for (const obj of res.objects) {
      const m = KEY_RE.exec(obj.key);
      if (!m) continue;
      let entry = byId.get(m[1]);
      if (!entry) {
        entry = {};
        byId.set(m[1], entry);
      }
      if (m[2] === "mp4") entry.mp4 = obj;
      else if (m[2] === "failed.json") entry.failed = obj;
      else entry.meta = obj;
    }
    if (!res.truncated) return { byId, truncated: false };
    cursor = res.cursor;
  }
  return { byId, truncated: true };
}

/** Baca JSON kecil dari R2; null bila tidak ada, terlalu besar, atau rusak. */
async function readJson(bucket, key) {
  try {
    const obj = await bucket.get(key);
    if (!obj || obj.size > MAX_JSON_BYTES) return null;
    const data = JSON.parse(await obj.text());
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Teruskan hanya field yang dikenal dan lolos validasi. */
function pickMeta(data, row) {
  if (!data) return;
  if (typeof data.composition === "string" && ID_RE.test(data.composition)) {
    row.composition = data.composition;
  }
  if (typeof data.quality === "string" && QUALITIES.has(data.quality)) {
    row.quality = data.quality;
  }
}

async function buildRow(bucket, id, entry) {
  if (entry.mp4) {
    // MP4 selalu menang atas penanda gagal lama (sama dengan GET /status/:id).
    const row = {
      id,
      status: "done",
      size: entry.mp4.size,
      uploaded: entry.mp4.uploaded.toISOString(),
    };
    if (entry.meta) pickMeta(await readJson(bucket, `renders/${id}.meta.json`), row);
    return row;
  }
  const data = await readJson(bucket, `renders/${id}.failed.json`);
  const row = {
    id,
    status: "failed",
    reason: data && data.reason === "cancelled" ? "cancelled" : "failed",
    uploaded: entry.failed.uploaded.toISOString(),
  };
  if (data && typeof data.run_url === "string" && RUN_URL_RE.test(data.run_url)) {
    row.run_url = data.run_url;
  }
  pickMeta(data, row);
  return row;
}

/** GET /renders?limit=N (default 30, maks 40) — terbaru lebih dulu. */
export async function handleRenders(request, env) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
  }
  if (!env.API_KEY || !env.VIDEOS) return json({ error: "server_not_configured" }, 500);

  const provided = request.headers.get("x-api-key") ?? "";
  if (!(await safeEqual(provided, env.API_KEY))) return json({ error: "unauthorized" }, 401);

  try {
    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
    const { byId, truncated } = await listRenderObjects(env.VIDEOS);

    const candidates = [];
    for (const [id, entry] of byId) {
      const source = entry.mp4 || entry.failed;
      if (source) candidates.push({ id, entry, time: source.uploaded.getTime() });
    }
    candidates.sort((a, b) => b.time - a.time);

    const page = candidates.slice(0, limit);
    const renders = await Promise.all(page.map((c) => buildRow(env.VIDEOS, c.id, c.entry)));
    return json({ renders, truncated });
  } catch (err) {
    console.error("renders_failed", err instanceof Error ? err.message : String(err));
    return json({ error: "internal_error" }, 500);
  }
}
