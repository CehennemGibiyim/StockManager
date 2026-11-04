// StockManager uygulama ikonunu (PNG + ICO) sıfırdan üretir.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'brand');
fs.mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function roundedRect(x, y, w, h, r) {
  const rx = Math.min(r, w / 2, h / 2);
  const dx = Math.max(Math.abs(x - w / 2) - (w / 2 - rx), 0);
  const dy = Math.max(Math.abs(y - h / 2) - (h / 2 - rx), 0);
  return dx * dx + dy * dy <= rx * rx;
}

const SIZE = 256;
const canvas = Buffer.alloc(SIZE * SIZE * 4);
const setPixel = (x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const alpha = a / 255;
  canvas[i] = Math.round(canvas[i] * (1 - alpha) + r * alpha);
  canvas[i + 1] = Math.round(canvas[i + 1] * (1 - alpha) + g * alpha);
  canvas[i + 2] = Math.round(canvas[i + 2] * (1 - alpha) + b * alpha);
  canvas[i + 3] = Math.max(canvas[i + 3], a);
};
const fillRounded = (ox, oy, w, h, r, color, alpha = 255) => {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!roundedRect(x + 0.5, y + 0.5, w, h, r)) continue;
      setPixel(ox + x, oy + y, color[0], color[1], color[2], alpha);
    }
  }
};

// Arka plan: koyu lacivert yuvarlatılmış kare + hafif degrade
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (!roundedRect(x + 0.5, y + 0.5, SIZE, SIZE, 58)) continue;
    const t = (x + y) / (SIZE * 2);
    setPixel(x, y, Math.round(9 + 12 * t), Math.round(15 + 20 * t), Math.round(27 + 34 * t), 255);
  }
}
// Üst köşe ışıması
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const d = Math.hypot(x - 70, y - 54);
    if (d < 120) setPixel(x, y, 56, 189, 248, Math.round(24 * (1 - d / 120)));
  }
}
// Yükselen stok çubukları
const bars = [
  { x: 60, y: 148, h: 52, color: [56, 189, 248] },
  { x: 108, y: 118, h: 82, color: [34, 211, 238] },
  { x: 156, y: 82, h: 118, color: [167, 139, 250] }
];
for (const bar of bars) fillRounded(bar.x, bar.y, 40, bar.h, 12, bar.color, 255);
// Alt çizgi
fillRounded(52, 202, 152, 10, 5, [226, 232, 240], 235);

const png = encodePng(SIZE, SIZE, canvas);
fs.writeFileSync(path.join(outDir, 'icon.png'), png);

function resize(source, size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = SIZE / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = Math.floor(y * scale); sy < Math.ceil((y + 1) * scale); sy += 1) {
        for (let sx = Math.floor(x * scale); sx < Math.ceil((x + 1) * scale); sx += 1) {
          const i = (sy * SIZE + sx) * 4;
          r += source[i];
          g += source[i + 1];
          b += source[i + 2];
          a += source[i + 3];
          count += 1;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }
  return encodePng(size, size, out);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => (size === SIZE ? png : resize(canvas, size)));
const ico = await pngToIco(pngs);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log(`icon.png ${png.length} bayt, icon.ico ${ico.length} bayt`);
