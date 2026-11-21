/**
 * POST /transcribe dan GET /transcript/:id — transkripsi audio berwaktu per kata.
 *
 * Worker TIDAK mentranskripsi apa pun (batas CPU 10 ms Workers Free). Ia hanya
 *   1. memvalidasi permintaan (x-api-key) lalu memicu repository_dispatch
 *      (event: transcribe-audio) -> .github/workflows/transcribe-audio.yml,
 *   2. menyajikan hasil dari R2:
 *        transcripts/<id>.json          sukses (kata berwaktu)
 *        transcripts/<id>.failed.json   gagal / dibatalkan
 *
 * Aset audio harus sudah diunggah lebih dulu (POST /asset atau PUT /asset-large),
 * lalu dirujuk lewat `composition` + `filename`.
 *
 * Hasil memuat transkrip kata orang yang berbicara, jadi GET /transcript/:id
 * dilindungi x-api-key (berbeda dengan /status yang publik).
 */

import { safeEqual } from "./auth.js";

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const AUDIO_EXT_RE = /\.(wav|mp3|m4a|aac|ogg|flac|mp4|webm|mov)$/i;
const LANGUAGE_RE = /^[a-z]{2,3}$/;
const MODELS = new Set(["tiny.en", "base.en", "small.en", "medium.en", "small", "medium", "large-v3"]);
const DEFAULT_MODEL = "small";
const DEFAULT_LANGUAGE = "id";
const RUN_URL_RE =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/;
const MAX_BODY_BYTES = 4096;

const resultKey = (id) => `transcripts/${id}.json`;
const failedKey = (id) => `transcripts/${id}.failed.json`;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

const methodNotAllowed = (allowed) =>
  json({ error: "method_not_allowed" }, 405, { allow: allowed.join(", ") });

const githubHeaders = (env) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${env.GITHUB_TOKEN}`,
  "content-type": "application/json",
  "user-agent": "hyperframes-render-worker",
  "x-github-api-version": "2022-11-28",
});

async function authorized(request, env) {
  const provided = request.headers.get("x-api-key") ?? "";
  return safeEqual(provided, env.API_KEY);
}

/** POST /transcribe  body: { id?, composition, filename, language?, model?, sha? } → 202 */
export async function handleTranscribe(request, env, origin) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!env.API_KEY || !env.GITHUB_TOKEN || !env.VIDEOS || !REPO_RE.test(env.GITHUB_REPO ?? "")) {
    return json({ error: "server_not_configured" }, 500);
  }
  if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "body_too_large" }, 413);
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_json" }, 400);
  }

  // id otomatis UUID (tak mudah ditebak) bila tidak diberikan.
  const id = body.id ?? crypto.randomUUID();
  const language = body.language ?? DEFAULT_LANGUAGE;
  const model = body.model ?? DEFAULT_MODEL;
  const { composition, filename } = body;

  if (typeof id !== "string" || !ID_RE.test(id)) return json({ error: "invalid_id" }, 400);
  if (typeof composition !== "string" || !ID_RE.test(composition)) {
    return json({ error: "invalid_composition" }, 400);
  }
  if (typeof filename !== "string" || !FILENAME_RE.test(filename) || !AUDIO_EXT_RE.test(filename)) {
    return json({ error: "invalid_filename" }, 400);
  }
  if (typeof language !== "string" || !LANGUAGE_RE.test(language)) {
    return json({ error: "invalid_language" }, 400);
  }
  if (typeof model !== "string" || !MODELS.has(model)) {
    return json({ error: "invalid_model", allowed: [...MODELS] }, 400);
  }
  if (body.sha !== undefined && (typeof body.sha !== "string" || !SHA_RE.test(body.sha))) {
    return json({ error: "invalid_sha" }, 400);
  }

  // Jangan menimpa hasil yang sudah ada.
  if (await env.VIDEOS.head(resultKey(id))) {
    return json({ error: "id_already_exists", id }, 409);
  }
  // id yang pernah gagal boleh dipakai ulang: hapus penanda lama (non-fatal).
  try {
    await env.VIDEOS.delete(failedKey(id));
  } catch (err) {
    console.error("clear_failed_marker", err instanceof Error ? err.message : String(err));
  }

  const clientPayload = { id, composition, filename, language, model };
  if (body.sha !== undefined) clientPayload.sha = body.sha;

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({ event_type: "transcribe-audio", client_payload: clientPayload }),
  });
  if (res.status !== 204) {
    console.error("dispatch_failed", res.status, (await res.text()).slice(0, 200));
    return json({ error: "dispatch_failed", github_status: res.status }, 502);
  }

  return json(
    {
      id,
      composition,
      filename,
      language,
      model,
      status: "queued",
      transcript_url: `${origin}/transcript/${id}`,
    },
    202,
  );
}

/**
 * GET /transcript/:id  (x-api-key)
 *   200  isi transcripts/<id>.json (disajikan apa adanya dari R2)
 *   410  {status:"failed", reason, run_url?}
 *   404  {status:"not_ready"}
 */
export async function handleTranscript(request, env, id) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed(["GET", "HEAD"]);
  }
  if (!env.API_KEY || !env.VIDEOS) return json({ error: "server_not_configured" }, 500);
  if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, 400);

  const done = await env.VIDEOS.get(resultKey(id));
  if (done) {
    // Hasil selalu menang atas penanda gagal lama. Body disalurkan tanpa di-parse (hemat CPU).
    return new Response(request.method === "HEAD" ? null : done.body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const failed = await env.VIDEOS.get(failedKey(id));
  if (failed) {
    let data = null;
    try {
      data = JSON.parse(await failed.text());
    } catch {
      data = null;
    }
    const out = { id, status: "failed", reason: data && data.reason === "cancelled" ? "cancelled" : "failed" };
    if (data && typeof data.run_url === "string" && RUN_URL_RE.test(data.run_url)) {
      out.run_url = data.run_url;
    }
    return json(out, 410);
  }

  return json({ id, status: "not_ready" }, 404);
}
