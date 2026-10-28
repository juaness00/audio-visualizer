// Original equalizer mark; deterministic supersampled RGB PNGs, no dependencies.
// Design coordinates use a 128px canvas. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/icon';
const SIZES = [16, 32, 48, 128];
const BG = [14, 15, 18];
// Five rounded spectrum bars, centered vertically. The silhouette stays legible at 16px.
const bars = [
  [24, 47, 12, 34],
  [41, 30, 12, 68],
  [58, 20, 12, 88],
  [75, 38, 12, 52],
  [92, 51, 12, 26],
];
function color(x, y) {
  const inside = bars.some(([bx, by, w, h]) => {
    const radius = w / 2;
    const cy = Math.max(by + radius, Math.min(by + h - radius, y));
    return (x - bx - radius) ** 2 + (y - cy) ** 2 <= radius ** 2;
  });
  return inside ? [255, Math.round(191 - y * 0.7), Math.round(112 - y * 0.55)] : BG;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  const samples = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++) {
          const sample = color(
            ((x + (sx + 0.5) / samples) * 128) / size,
            ((y + (sy + 0.5) / samples) * 128) / size,
          );
          sample.forEach((v, c) => (rgb[c] += v));
        }
      const i = y * (1 + size * 3) + 1 + x * 3;
      rgb.forEach((v, c) => (raw[i + c] = Math.round(v / samples ** 2)));
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) writeFileSync(`${OUT}/${size}.png`, png(size));
console.log(`wrote ${SIZES.map((s) => `${OUT}/${s}.png`).join(', ')}`);
