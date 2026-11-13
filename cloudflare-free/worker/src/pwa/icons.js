/**
 * Ikon PWA (data biner dalam base64) dan ikon SVG untuk tab browser.
 *
 * PNG: kotak biru #246BFD penuh (full-bleed) dengan bingkai putih dan segitiga play, mengikuti logo
 * di ui/markup.js. Seluruh gambar berada di dalam safe zone maskable (lingkaran berjari-jari 40%
 * sisi), jadi file yang sama dipakai untuk purpose "any" dan "maskable" di manifest.
 * PNG berpalet: 192 px = 2 bit (4 tingkat anti-alias), 432 byte; 512 px = 1 bit, 786 byte.
 *
 * Integritas data dicek saat runtime (CRC tiap chunk, ukuran gambar) oleh ./png.js; bila rusak,
 * Worker memakai PNG polos buatan kode, jadi manifest tidak pernah menunjuk ikon yang rusak.
 */

const ICON_192_B64 = [
  "iVBORw0KGgoAAAANSUhEUgAAAMAAAADAAgMAAAAvsoSUAAAADFBMVEUka/3///9tnP62zv5NIZGhAAAB",
  "X0lEQVR42u2YPU7DQBBGLSwKhFLmCCkRVe5BkVm7sFCO4JIK+RLpqekpkXIJdyk4Bh0U/Eo7Y/khVknx",
  "vdLaJ3l27Z39tqqEEEIIIcRJcW0Zr1PjL83hZUJ48oQUj6/NZR8KC1/oQ2HtC5tQGH2hicafmbEiLiJh",
  "y2qOq16Z2VvGaNbGk3SXP70y6wJh6ZZXx/O6M/MnO4VC8h834bpt/DeNhc6fCwlHEh6ocKDCOFChp0Ki",
  "wu8NdZ7QUcEGKvRUSFT42UDmCi0VmgEK32XPFhIVvsqeL7RUaKjw2XmAcEuFj7KJ0BYX6CslWnRPF24o",
  "/WnsS3/e+Aeiv2hXeptJxbfKofR2TxsKblm4KdK2ixs7PjroRHZcAR7WcRzAgQNHmrUbwBZxaFqZNY8Z",
  "E7EsDH43/xUtaxpeo3hsYZ5e0gB+zmr+wyVCtYPXFP7EbqeuTp7z8fe6gBJCCCGEOC3eASX70Ft5h+az",
  "AAAAAElFTkSuQmCC",
].join("");

const ICON_512_B64 = [
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAABlBMVEX///8ka/0vgwGPAAACx0lEQVR4",
  "2u3bwW3kIBTGcRAHjpRAKZSGV1tASkgrLmVK8NEHa7K3lTY28Cb/WEjZj+tEP8nMxMDjfe4DDidAgAAB",
  "AgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECDgHmB1lyNYgYdrjGgDnq45qgnY2kAyAUsb8Bag",
  "8wRXz3AG9h6QDcDWA5IBWHtAMABLD/AGwLmXZvEEHH2gDIG9D+QhsPWBNAQefSAOgbUPhCGw9AFPATcE",
  "HASeI6AOgGMEFArkAbBTYBsB6W7gMQLi3cA6AoIFaC6kBmBpLIF/n88bgNwCdiNQW8DTAPSm4PLTC8C3",
  "gcUEhDawmoDYBh7nGXLnacJAagMbBXYTkKcDpQ0c54/d8C8ECBAgQMBPAd4p8EaB3xT4RYGlUqBQIFEg",
  "UMBT4PN25HWgUCBRIFDAU+DTLH4BKBRIFIgU8BT4dxa/AhQKJApECngKOAwUCiQKRAp4CjgMFApkCkQK",
  "eAo4DBQKZApECgQKOAwUCmQKRAoECjgMVApkCkQKBAo4DFQKZApECgQKOAxUCmQKJArE6Y9QZ3+NYfpP",
  "Gf8zldkvlDD9pYpf62X20oYXV7y84w0G3uLQTZafvtHEW1282Z5+4MBHnjT92Df96IsP3/j4jwsQ04sw",
  "uAyEC1G4FEaLcbgciAuSuCSKi7K0LIwL07g0jovz+HqAXlDgKxJ8SZMoUChQIYAv6/B14RsF3inwIUCA",
  "AAEC/nPA0OSJgToE0o3ARpt9xwBuN/6Whmfccs2avnHb+bc0vqPW+7U3i4s1PUDiB/MTFPNTJDgIc9wO",
  "lAGA40g4EMUBHArDsTQcjMPRPBwOxPHEJw1I8ogmDonimCoOyuKoLg4L9yYhmoDjhZ/RdWR7tX+JjdC4",
  "9WXSBF4ZAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAjjwB+OBsiwE9AagAAAAAElF",
  "TkSuQmCC",
].join("");

export { ICON_192_B64, ICON_512_B64 };

export const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8aff"/><stop offset="1" stop-color="#246BFD"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><rect x="7" y="8" width="18" height="16" rx="3" fill="none" stroke="#fff" stroke-width="1.8" opacity=".95"/><path d="M14 12.2v7.6l6-3.8z" fill="#fff"/></svg>';
