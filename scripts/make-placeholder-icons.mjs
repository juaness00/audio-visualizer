// Writes solid placeholder PNGs at the sizes Chrome wants, with no dependencies.
// Real icons replace these in LOS-16. Run: node scripts/make-placeholder-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/icon';
const SIZES = [16, 32, 48, 128];
const BG = [14, 15, 18];
const FG = [242, 153, 74];

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
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= (r * 0.72) ** 2;
      const [cr, cg, cb] = inside ? FG : BG;
      const i = y * (1 + size * 3) + 1 + x * 3;
      raw[i] = cr;
      raw[i + 1] = cg;
      raw[i + 2] = cb;
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
