/**
 * @module binary-reader
 * Big-endian DataView wrapper for parsing Photoshop binary formats.
 *
 * ABR, ASL, and PSD files are all big-endian. This helper provides
 * convenient read methods with automatic offset tracking.
 */

/**
 * Big-endian binary reader wrapping a DataView.
 * Tracks the current read position automatically.
 */
export class BinaryReader {
  private view: DataView;
  private _offset: number;

  constructor(buffer: ArrayBuffer, offset = 0) {
    this.view = new DataView(buffer);
    this._offset = offset;
  }

  /** Current read position in the buffer. */
  get offset(): number {
    return this._offset;
  }

  /** Total byte length of the underlying buffer. */
  get length(): number {
    return this.view.byteLength;
  }

  /** Number of bytes remaining from current position. */
  get remaining(): number {
    return this.view.byteLength - this._offset;
  }

  /** Whether the current position is at or past the end. */
  get eof(): boolean {
    return this._offset >= this.view.byteLength;
  }

  /** Skip forward by a number of bytes. */
  skip(bytes: number): void {
    this._offset += bytes;
  }

  /** Set the read position to an absolute offset. */
  seek(offset: number): void {
    this._offset = offset;
  }

  /** Read an unsigned 8-bit integer. */
  readUint8(): number {
    const val = this.view.getUint8(this._offset);
    this._offset += 1;
    return val;
  }

  /** Read a signed 16-bit integer (big-endian). */
  readInt16(): number {
    const val = this.view.getInt16(this._offset, false);
    this._offset += 2;
    return val;
  }

  /** Read an unsigned 16-bit integer (big-endian). */
  readUint16(): number {
    const val = this.view.getUint16(this._offset, false);
    this._offset += 2;
    return val;
  }

  /** Read a signed 32-bit integer (big-endian). */
  readInt32(): number {
    const val = this.view.getInt32(this._offset, false);
    this._offset += 4;
    return val;
  }

  /** Read an unsigned 32-bit integer (big-endian). */
  readUint32(): number {
    const val = this.view.getUint32(this._offset, false);
    this._offset += 4;
    return val;
  }

  /** Read a 32-bit IEEE float (big-endian). */
  readFloat32(): number {
    const val = this.view.getFloat32(this._offset, false);
    this._offset += 4;
    return val;
  }

  /** Read a 64-bit IEEE double (big-endian). */
  readFloat64(): number {
    const val = this.view.getFloat64(this._offset, false);
    this._offset += 8;
    return val;
  }

  /** Read raw bytes as a Uint8Array. */
  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this._offset, length);
    this._offset += length;
    return bytes;
  }

  /** Read a fixed-length ASCII string. */
  readString(length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.view.getUint8(this._offset + i));
    }
    this._offset += length;
    return str;
  }

  /** Read a Pascal string (1-byte length prefix). */
  readPascalString(): string {
    const len = this.readUint8();
    if (len === 0) {
      // Pad to even
      this._offset += 1;
      return '';
    }
    const str = this.readString(len);
    // Pad to even total (length byte + string)
    if ((len + 1) % 2 !== 0) {
      this._offset += 1;
    }
    return str;
  }

  /** Read a Unicode string (4-byte length prefix, UTF-16BE). */
  readUnicodeString(): string {
    const charCount = this.readUint32();
    if (charCount === 0) return '';
    let str = '';
    for (let i = 0; i < charCount; i++) {
      const code = this.readUint16();
      if (code !== 0) {
        str += String.fromCharCode(code);
      }
    }
    return str;
  }
}
