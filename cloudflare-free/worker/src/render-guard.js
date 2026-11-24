/**
 * Atomic render reservations and immutable snapshots of R2 assets.
 *
 * A reservation key is intentionally retained after completion: render IDs are
 * one-time identifiers, preventing duplicate dispatches and accidental overwrite.
 */
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const ASSET_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const MAX_ASSETS = 100;
const MAX_SNAPSHOT_BYTES = 500 * 1024 * 1024;

const lockKey = (id) => `renders/${id}.lock.json`;
const snapshotPrefix = (id) => `render-assets/${id}/`;

export async function reserveRender(bucket, id, metadata) {
  if (!ID_RE.test(id)) throw new TypeError("invalid_render_id");
  const value = {
    id,
    ...metadata,
    status: "reserved",
  };
  const object = await bucket.put(lockKey(id), JSON.stringify(value), {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return object !== null;
}

export async function releaseRender(bucket, id) {
  if (!ID_RE.test(id)) return;
  await bucket.delete(lockKey(id));
}

export async function removeRenderAssetSnapshot(bucket, id) {
  if (!ID_RE.test(id)) return;
  const prefix = snapshotPrefix(id);
  const listed = await bucket.list({ prefix, limit: MAX_ASSETS });
  if (listed.truncated) throw new Error("render_asset_snapshot_cleanup_limit");
  if (listed.objects.length) await bucket.delete(listed.objects.map((item) => item.key));
}

/**
 * Snapshot all large assets uploaded under assets/<composition>/ into a
 * render-specific prefix. R2 conditional reads ensure the copied bytes match
 * the ETag observed in the listing; create-only writes prevent replacement.
 */
export async function snapshotCompositionAssets(bucket, composition, id) {
  if (!ID_RE.test(composition) || !ID_RE.test(id)) throw new TypeError("invalid_snapshot_path");
  const sourcePrefix = `assets/${composition}/`;
  const destinationPrefix = snapshotPrefix(id);
  const listed = await bucket.list({ prefix: sourcePrefix, limit: MAX_ASSETS });
  if (listed.truncated) throw new Error("too_many_render_assets");

  const objects = listed.objects || [];
  let totalBytes = 0;
  for (const item of objects) {
    const filename = item.key.slice(sourcePrefix.length);
    if (!ASSET_NAME_RE.test(filename)) throw new Error("invalid_render_asset_key");
    if (!Number.isSafeInteger(item.size) || item.size <= 0) throw new Error("invalid_render_asset_size");
    totalBytes += item.size;
    if (totalBytes > MAX_SNAPSHOT_BYTES) throw new Error("render_assets_too_large");
  }

  const copied = [];
  try {
    for (const item of objects) {
      const filename = item.key.slice(sourcePrefix.length);
      const source = await bucket.get(item.key, { onlyIf: { etagMatches: item.etag } });
      if (!source || !source.body) throw new Error("render_asset_changed_during_snapshot");

      const stream = new FixedLengthStream(item.size);
      const destinationKey = destinationPrefix + filename;
      const write = bucket.put(destinationKey, stream.readable, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
      await source.body.pipeTo(stream.writable);
      const stored = await write;
      if (!stored) throw new Error("render_asset_snapshot_conflict");
      copied.push(destinationKey);
    }
  } catch (error) {
    if (copied.length) await bucket.delete(copied);
    throw error;
  }

  return { count: copied.length, bytes: totalBytes, prefix: destinationPrefix };
}
