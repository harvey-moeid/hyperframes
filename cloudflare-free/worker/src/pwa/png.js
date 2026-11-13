/**
 * Utilitas PNG kecil tanpa dependensi untuk lapisan PWA.
 *
 *  - isValidPng: memeriksa tanda tangan, CRC setiap chunk, urutan IHDR..IEND, dan ukuran gambar.
 *  - solidPng:   membuat PNG polos (satu warna, palet 1 bit) sebagai cadangan bila data ikon rusak.
 *  - base64ToBytes: dekode base64 standar.
 *
 * Dipakai hanya untuk ikon kecil (<= 5 KB data), jadi biayanya jauh di bawah batas CPU Workers Free.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let crcTable = null;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** true bila bytes adalah PNG utuh berukuran size x size (CRC semua chunk cocok). */
export function isValidPng(bytes, size) {
  try {
    if (bytes.length < 45) return false;
    for (let i = 0; i < SIGNATURE.length; i++) if (bytes[i] !== SIGNATURE[i]) return false;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let off = 8;
    let first = true;
    let sawIdat = false;
    while (off + 12 <= bytes.length) {
      const len = dv.getUint32(off);
      const end = off + 8 + len;
      if (end + 4 > bytes.length) return false;
      const type = String.fromCharCode(
        bytes[off + 4],
        bytes[off + 5],
        bytes[off + 6],
        bytes[off + 7],
      );
      if (crc32(bytes.subarray(off + 4, end)) !== dv.getUint32(end)) return false;
      if (first) {
        if (type !== "IHDR" || len !== 13) return false;
        if (dv.getUint32(off + 8) !== size || dv.getUint32(off + 12) !== size) return false;
        first = false;
      }
      if (type === "IDAT") sawIdat = true;
      off = end + 4;
      if (type === "IEND") return sawIdat && off === bytes.length;
    }
    return false;
  } catch {
    return false;
  }
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** PNG polos size x size dengan warna [r, g, b]; deflate "stored" (tanpa kompresi), palet 1 bit. */
export function solidPng(size, rgb) {
  const rowBytes = Math.ceil(size / 8);
  const raw = new Uint8Array(size * (rowBytes + 1)); // filter 0 + semua piksel indeks 0
  const blocks = [];
  let total = 2; // header zlib
  for (let pos = 0; pos < raw.length; pos += 65535) {
    const part = raw.subarray(pos, Math.min(pos + 65535, raw.length));
    const last = pos + 65535 >= raw.length;
    const head = new Uint8Array([
      last ? 1 : 0,
      part.length & 255,
      part.length >>> 8,
      ~part.length & 255,
      (~part.length >>> 8) & 255,
    ]);
    blocks.push(head, part);
    total += head.length + part.length;
  }
  total += 4; // Adler-32
  const z = new Uint8Array(total);
  z[0] = 0x78;
  z[1] = 0x01;
  let off = 2;
  for (const b of blocks) {
    z.set(b, off);
    off += b.length;
  }
  new DataView(z.buffer).setUint32(off, adler32(raw));

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 1; // kedalaman bit
  ihdr[9] = 3; // berpalet
  const plte = new Uint8Array([rgb[0], rgb[1], rgb[2], 255, 255, 255]);
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", z),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
