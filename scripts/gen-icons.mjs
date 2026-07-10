// Generates simple PNG app icons (magnifying-glass glyph on a blue
// background) with zero external dependencies, using only Node's zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function buildPng(size) {
  const bg = [37, 99, 235]; // #2563eb
  const glyph = [255, 255, 255];
  const cx = size * 0.44;
  const cy = size * 0.44;
  const r = size * 0.24;
  const ringWidth = size * 0.07;
  const handleLen = size * 0.26;
  const handleWidth = size * 0.075;
  const angle = Math.PI / 4;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    let rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      let [r8, g8, b8] = bg;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Ring (magnifying glass lens)
      if (dist >= r - ringWidth / 2 && dist <= r + ringWidth / 2) {
        [r8, g8, b8] = glyph;
      } else {
        // Handle: a short diagonal segment from the ring going down-right
        const hx0 = cx + Math.cos(angle) * r;
        const hy0 = cy + Math.sin(angle) * r;
        const hx1 = hx0 + Math.cos(angle) * handleLen;
        const hy1 = hy0 + Math.sin(angle) * handleLen;
        const px = x, py = y;
        const segDx = hx1 - hx0, segDy = hy1 - hy0;
        const segLenSq = segDx * segDx + segDy * segDy;
        let t = segLenSq > 0 ? ((px - hx0) * segDx + (py - hy0) * segDy) / segLenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const projX = hx0 + t * segDx;
        const projY = hy0 + t * segDy;
        const segDist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
        if (segDist <= handleWidth / 2) {
          [r8, g8, b8] = glyph;
        }
      }
      const off = rowStart + 1 + x * 4;
      raw[off] = r8;
      raw[off + 1] = g8;
      raw[off + 2] = b8;
      raw[off + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, buildPng(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
