/**
 * Convert a Node.js Buffer to an exact ArrayBuffer view.
 * This avoids leaking extra bytes from pooled Buffer backing storage.
 */
export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(out).set(buffer);
  return out;
}
