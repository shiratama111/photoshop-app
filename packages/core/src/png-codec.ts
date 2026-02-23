/**
 * @module png-codec
 * Minimal PNG encoder/decoder using fflate for deflate/inflate.
 * Pure JS — no browser APIs required (works in Node test environments).
 *
 * @see CORE-003: Project file (.psxp) implementation
 * @see https://www.w3.org/TR/PNG/ — PNG specification
 */

import { deflateSync, inflateSync } from 'fflate';

/** RGBA image data suitable for PNG encoding/decoding. */
export interface RgbaImage {
  /** RGBA pixel data. Length must be width * height * 4. */
  data: Uint8Array | Uint8ClampedArray;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

// ── CRC32 lookup table (256 entries) ──

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(data: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Helpers ──

function write32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function read32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>>
    0
  );
}

// PNG signature: 8 bytes
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Encodes an RGBA image as a PNG file.
 * Uses filter type 0 (None) for simplicity.
 *
 * @param image - The RGBA image to encode.
 * @returns PNG file data as Uint8Array.
 */
export function encodePng(image: RgbaImage): Uint8Array {
  const { data, width, height } = image;

  if (data.length !== width * height * 4) {
    throw new Error(
      `Image data length (${data.length}) does not match dimensions (${width}x${height}x4 = ${width * height * 4})`,
    );
  }

  // Build raw scanlines with filter byte 0 (None) prepended to each row
  const rowBytes = width * 4;
  const rawData = new Uint8Array(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + rowBytes)] = 0; // filter: None
    rawData.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (1 + rowBytes) + 1);
  }

  const compressed = deflateSync(rawData);

  // Calculate chunk sizes
  const ihdrDataLen = 13;
  const ihdrChunkLen = 12 + ihdrDataLen; // length(4) + type(4) + data + crc(4)
  const idatChunkLen = 12 + compressed.length;
  const iendChunkLen = 12;
  const totalLen = 8 + ihdrChunkLen + idatChunkLen + iendChunkLen;

  const out = new Uint8Array(totalLen);
  let offset = 0;

  // PNG signature
  out.set(PNG_SIGNATURE, offset);
  offset += 8;

  // IHDR chunk
  write32(out, offset, ihdrDataLen);
  offset += 4;
  const ihdrStart = offset;
  out[offset] = 0x49; // I
  out[offset + 1] = 0x48; // H
  out[offset + 2] = 0x44; // D
  out[offset + 3] = 0x52; // R
  offset += 4;
  write32(out, offset, width);
  offset += 4;
  write32(out, offset, height);
  offset += 4;
  out[offset++] = 8; // bit depth
  out[offset++] = 6; // color type: RGBA
  out[offset++] = 0; // compression method
  out[offset++] = 0; // filter method
  out[offset++] = 0; // interlace method
  write32(out, offset, crc32(out, ihdrStart, offset));
  offset += 4;

  // IDAT chunk
  write32(out, offset, compressed.length);
  offset += 4;
  const idatStart = offset;
  out[offset] = 0x49; // I
  out[offset + 1] = 0x44; // D
  out[offset + 2] = 0x41; // A
  out[offset + 3] = 0x54; // T
  offset += 4;
  out.set(compressed, offset);
  offset += compressed.length;
  write32(out, offset, crc32(out, idatStart, offset));
  offset += 4;

  // IEND chunk
  write32(out, offset, 0);
  offset += 4;
  const iendStart = offset;
  out[offset] = 0x49; // I
  out[offset + 1] = 0x45; // E
  out[offset + 2] = 0x4e; // N
  out[offset + 3] = 0x44; // D
  offset += 4;
  write32(out, offset, crc32(out, iendStart, offset));

  return out;
}

/**
 * Decodes a PNG file into RGBA image data.
 * Supports filter types 0-4 (None, Sub, Up, Average, Paeth).
 *
 * @param png - PNG file data.
 * @returns Decoded RGBA image.
 */
export function decodePng(png: Uint8Array): RgbaImage {
  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (png[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature');
    }
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  let offset = 8;
  while (offset < png.length) {
    const length = read32(png, offset);
    offset += 4;
    const typeStr = String.fromCharCode(png[offset], png[offset + 1], png[offset + 2], png[offset + 3]);
    offset += 4;

    if (typeStr === 'IHDR') {
      width = read32(png, offset);
      height = read32(png, offset + 4);
      bitDepth = png[offset + 8];
      colorType = png[offset + 9];

      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}. Only 8-bit RGBA is supported.`);
      }
    } else if (typeStr === 'IDAT') {
      idatChunks.push(png.slice(offset, offset + length));
    } else if (typeStr === 'IEND') {
      break;
    }

    offset += length + 4; // skip data + CRC
  }

  if (width === 0 || height === 0) {
    throw new Error('PNG missing IHDR chunk');
  }

  // Concatenate IDAT chunks and inflate
  let totalLen = 0;
  for (const chunk of idatChunks) totalLen += chunk.length;
  const combined = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of idatChunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  const rawData = inflateSync(combined);
  const rowBytes = width * 4;
  const data = new Uint8Array(width * height * 4);

  // Reconstruct scanlines with filter reversal
  for (let y = 0; y < height; y++) {
    const filterType = rawData[y * (1 + rowBytes)];
    const scanlineOffset = y * (1 + rowBytes) + 1;
    const outOffset = y * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const raw = rawData[scanlineOffset + x];
      let a = 0; // left pixel
      let b = 0; // above pixel
      let c = 0; // above-left pixel

      if (x >= 4) {
        a = data[outOffset + x - 4];
      }
      if (y > 0) {
        b = data[outOffset - rowBytes + x];
      }
      if (x >= 4 && y > 0) {
        c = data[outOffset - rowBytes + x - 4];
      }

      let reconstructed: number;
      switch (filterType) {
        case 0: // None
          reconstructed = raw;
          break;
        case 1: // Sub
          reconstructed = (raw + a) & 0xff;
          break;
        case 2: // Up
          reconstructed = (raw + b) & 0xff;
          break;
        case 3: // Average
          reconstructed = (raw + ((a + b) >> 1)) & 0xff;
          break;
        case 4: // Paeth
          reconstructed = (raw + paethPredictor(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }

      data[outOffset + x] = reconstructed;
    }
  }

  return { data, width, height };
}

/**
 * Paeth predictor function used in PNG filter type 4.
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
