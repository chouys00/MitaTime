/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 純 Node Buffer 產生 32x32 RGBA PNG（番茄色圓形）
 * 不依賴任何第三方套件，於 pnpm dev / pnpm build 前執行。
 */
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size = 32) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const radius = size / 2 - 1;
  const innerRadius = radius - 2.5;

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = 1 + x * 4;

      if (dist <= innerRadius) {
        row[offset] = 130;
        row[offset + 1] = 215;
        row[offset + 2] = 195;
        row[offset + 3] = 255;
      } else if (dist <= radius) {
        const ratio = (radius - dist) / Math.max(0.0001, radius - innerRadius);
        const alpha = Math.round(255 * ratio);
        row[offset] = 130;
        row[offset + 1] = 215;
        row[offset + 2] = 195;
        row[offset + 3] = alpha;
      } else {
        row[offset] = 0;
        row[offset + 1] = 0;
        row[offset + 2] = 0;
        row[offset + 3] = 0;
      }
    }
    rows.push(row);
  }

  const idatRaw = Buffer.concat(rows);
  const idat = zlib.deflateSync(idatRaw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outputDir = path.resolve(__dirname, '..', 'resources');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'icon.png');
fs.writeFileSync(outputPath, generatePng(256));
console.log(`[generate-icon] wrote ${outputPath}`);
