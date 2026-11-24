import test from "node:test";
import assert from "node:assert/strict";
import {
  reserveRender,
  releaseRender,
  snapshotCompositionAssets,
  removeRenderAssetSnapshot,
} from "../src/render-guard.js";

class TestFixedLengthStream {
  constructor() {
    const stream = new TransformStream();
    this.readable = stream.readable;
    this.writable = stream.writable;
  }
}
globalThis.FixedLengthStream = TestFixedLengthStream;

function makeBucket(initial = {}) {
  const objects = new Map();
  for (const [key, value] of Object.entries(initial)) {
    const bytes = new TextEncoder().encode(value);
    objects.set(key, { bytes, etag: "etag-" + key, httpMetadata: { contentType: "application/octet-stream" } });
  }
  return {
    objects,
    async put(key, value, options = {}) {
      if (options.onlyIf?.etagDoesNotMatch === "*" && objects.has(key)) return null;
      const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, { bytes, etag: "new-" + key, httpMetadata: options.httpMetadata || {} });
      return { key, size: bytes.length };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    async list({ prefix, limit }) {
      const rows = [...objects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .slice(0, limit)
        .map(([key, value]) => ({ key, size: value.bytes.length, etag: value.etag }));
      return { objects: rows, truncated: false };
    },
    async get(key, options = {}) {
      const value = objects.get(key);
      if (!value) return null;
      if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== value.etag) return { body: undefined };
      return { body: new Response(value.bytes).body, etag: value.etag, size: value.bytes.length, httpMetadata: value.httpMetadata };
    },
  };
}

test("render reservation is atomic and one-time", async () => {
  const bucket = makeBucket();
  const results = await Promise.all([
    reserveRender(bucket, "render-123", { composition: "promo" }),
    reserveRender(bucket, "render-123", { composition: "promo" }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await reserveRender(bucket, "render-123", { composition: "promo" }), false);
  await releaseRender(bucket, "render-123");
  assert.equal(await reserveRender(bucket, "render-123", { composition: "promo" }), true);
});

test("R2 assets are copied to an immutable render-specific prefix", async () => {
  const bucket = makeBucket({ "assets/promo/intro.mp4": "video-bytes", "assets/promo/cover.png": "image-bytes" });
  const result = await snapshotCompositionAssets(bucket, "promo", "render-456");
  assert.equal(result.count, 2);
  assert.equal(result.bytes, 21);
  assert.ok(bucket.objects.has("render-assets/render-456/intro.mp4"));
  assert.ok(bucket.objects.has("render-assets/render-456/cover.png"));
  await removeRenderAssetSnapshot(bucket, "render-456");
  assert.equal(bucket.objects.has("render-assets/render-456/intro.mp4"), false);
});

test("snapshot refuses an asset that changed after listing", async () => {
  const bucket = makeBucket({ "assets/promo/intro.mp4": "old-bytes" });
  const originalList = bucket.list.bind(bucket);
  let listed = false;
  bucket.list = async (options) => {
    const result = await originalList(options);
    if (!listed) {
      listed = true;
      bucket.objects.set("assets/promo/intro.mp4", {
        bytes: new TextEncoder().encode("new-bytes"),
        etag: "changed-etag",
        httpMetadata: {},
      });
    }
    return result;
  };
  await assert.rejects(
    snapshotCompositionAssets(bucket, "promo", "render-789"),
    /changed_during_snapshot/,
  );
  assert.equal(bucket.objects.has("render-assets/render-789/intro.mp4"), false);
});
