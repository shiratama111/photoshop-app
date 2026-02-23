/**
 * @module test-helpers
 * Binary writer utility for constructing test ABR buffers.
 */

/**
 * Simple binary writer for constructing big-endian byte buffers in tests.
 */
export class BinaryWriter {
  private chunks: Uint8Array[] = [];

  writeUint8(value: number): void {
    const buf = new Uint8Array(1);
    buf[0] = value & 0xff;
    this.chunks.push(buf);
  }

  writeUint16(value: number): void {
    const buf = new Uint8Array(2);
    buf[0] = (value >> 8) & 0xff;
    buf[1] = value & 0xff;
    this.chunks.push(buf);
  }

  writeUint32(value: number): void {
    const buf = new Uint8Array(4);
    buf[0] = (value >> 24) & 0xff;
    buf[1] = (value >> 16) & 0xff;
    buf[2] = (value >> 8) & 0xff;
    buf[3] = value & 0xff;
    this.chunks.push(buf);
  }

  writeString(str: string): void {
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      buf[i] = str.charCodeAt(i);
    }
    this.chunks.push(buf);
  }

  writeBytes(data: Uint8Array): void {
    this.chunks.push(new Uint8Array(data));
  }

  toUint8Array(): Uint8Array {
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  toArrayBuffer(): ArrayBuffer {
    return this.toUint8Array().buffer;
  }
}
