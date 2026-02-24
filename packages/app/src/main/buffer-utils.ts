/**
 * Convert a Node.js Buffer to an exact ArrayBuffer view.
 * This avoids leaking extra bytes from pooled Buffer backing storage.
 */
export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
