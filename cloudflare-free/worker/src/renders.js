/**
 * GET /renders — daftar render dari R2 untuk sinkronisasi riwayat lintas perangkat.
 *
 * Sumber kebenaran adalah objek renders/<id>.mp4, .failed.json, dan .meta.json di R2.
 * Endpoint dilindungi x-api-key karena daftar ini membuka semua ID render.
 * Batas Workers Free: maksimal 5 operasi list dan 40 pembacaan JSON per invocation.
 */

import { safeEqual } from "./auth.js";

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

function parseLimit(raw) {
  if (raw === null || !/^[0-9]{1,3}$/.test(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Number(raw), 1), MAX_LIMIT);
}

function addRenderObjects(byId, objects) {
  for (const object of objects) {
    const match = KEY_RE.exec(object.key);
    if (!match) continue;

    const [, id, kind] = match;
    const entry = byId.get(id) ?? {};
    if (kind === "mp4") entry.mp4 = object;
    else if (kind === "failed.json") entry.failed = object;
    else entry.meta = object;
    byId.set(id, entry);
  }
}

async function listRenderObjects(bucket) {
  const byId = new Map();
  let cursor;

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const result = await bucket.list({ prefix: "renders/", cursor, limit: 1000 });
    addRenderObjects(byId, result.objects);
    if (!result.truncated) return { byId, truncated: false };
    cursor = result.cursor;
  }

  return { byId, truncated: true };
}

function parseJsonObject(raw) {
  try {
    const data = JSON.parse(raw);
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function readJson(bucket, key) {
  try {
    const object = await bucket.get(key);
    if (!object || object.size > MAX_JSON_BYTES) return null;
    return parseJsonObject(await object.text());
  } catch {
    return null;
  }
}

function pickMeta(data, row) {
  if (!data) return;
  if (typeof data.composition === "string" && ID_RE.test(data.composition)) {
    row.composition = data.composition;
  }
  if (typeof data.quality === "string" && QUALITIES.has(data.quality)) {
    row.quality = data.quality;
  }
}

async function buildDoneRow(bucket, id, entry) {
  const row = {
    id,
    status: "done",
    size: entry.mp4.size,
    uploaded: entry.mp4.uploaded.toISOString(),
  };
  if (entry.meta) pickMeta(await readJson(bucket, `renders/${id}.meta.json`), row);
  return row;
}

async function buildFailedRow(bucket, id, entry) {
  const data = await readJson(bucket, `renders/${id}.failed.json`);
  const row = {
    id,
    status: "failed",
    reason: data?.reason === "cancelled" ? "cancelled" : "failed",
    uploaded: entry.failed.uploaded.toISOString(),
  };

  if (typeof data?.run_url === "string" && RUN_URL_RE.test(data.run_url)) {
    row.run_url = data.run_url;
  }
  pickMeta(data, row);
  return row;
}

async function buildRow(bucket, id, entry) {
  return entry.mp4
    ? buildDoneRow(bucket, id, entry)
    : buildFailedRow(bucket, id, entry);
}

function collectCandidates(byId) {
  const candidates = [];
  for (const [id, entry] of byId) {
    const source = entry.mp4 || entry.failed;
    if (source) candidates.push({ id, entry, time: source.uploaded.getTime() });
  }
  candidates.sort((a, b) => b.time - a.time);
  return candidates;
}

async function authorize(request, env) {
  if (!env.API_KEY || !env.VIDEOS) {
    return json({ error: "server_not_configured" }, 500);
  }
  const provided = request.headers.get("x-api-key") ?? "";
  if (!(await safeEqual(provided, env.API_KEY))) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

/** GET /renders?limit=N (default 30, maks 40) — terbaru lebih dulu. */
export async function handleRenders(request, env) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
  }

  const authError = await authorize(request, env);
  if (authError) return authError;

  try {
    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
    const { byId, truncated } = await listRenderObjects(env.VIDEOS);
    const page = collectCandidates(byId).slice(0, limit);
    const renders = await Promise.all(page.map(({ id, entry }) => buildRow(env.VIDEOS, id, entry)));
    return json({ renders, truncated });
  } catch (err) {
    console.error("renders_failed", err instanceof Error ? err.message : String(err));
    return json({ error: "internal_error" }, 500);
  }
}
