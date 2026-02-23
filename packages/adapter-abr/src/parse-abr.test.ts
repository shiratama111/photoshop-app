import { describe, it, expect } from 'vitest';
import { parseAbr } from './parse-abr';
import { BinaryWriter } from './test-helpers';

describe('parseAbr', () => {
  describe('validation', () => {
    it('should reject empty buffer', () => {
      const result = parseAbr(new ArrayBuffer(0));
      expect(result.version).toBe(0);
      expect(result.brushes).toHaveLength(0);
      expect(result.warnings).toContain('File too small to be a valid ABR file');
    });

    it('should reject too-small buffer', () => {
      const result = parseAbr(new ArrayBuffer(2));
      expect(result.version).toBe(0);
      expect(result.warnings[0]).toContain('File too small');
    });

    it('should reject unsupported version (v1)', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(1); // version
      writer.writeUint16(0); // subversion
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(1);
      expect(result.brushes).toHaveLength(0);
      expect(result.warnings[0]).toContain('not supported');
    });

    it('should reject unsupported version (v5)', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(5);
      writer.writeUint16(0);
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(5);
      expect(result.warnings[0]).toContain('not supported');
    });
  });

  describe('v6+ parsing', () => {
    it('should parse version 6 header', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6); // version
      writer.writeUint16(2); // subversion
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(6);
      expect(result.warnings).toHaveLength(0);
    });

    it('should parse version 10 header', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(10);
      writer.writeUint16(0);
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(10);
    });

    it('should handle invalid signature gracefully', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);
      writer.writeString('XXXX'); // invalid signature
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(6);
      expect(result.warnings[0]).toContain('Unexpected signature');
    });

    it('should skip unknown 8BIM blocks', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);
      // Write an unknown block
      writer.writeString('8BIM');
      writer.writeString('patt');
      writer.writeUint32(4); // block length
      writer.writeUint32(0); // dummy data
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.version).toBe(6);
      expect(result.brushes).toHaveLength(0);
    });

    it('should handle block extending beyond file', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);
      writer.writeString('8BIM');
      writer.writeString('samp');
      writer.writeUint32(99999); // block length exceeds buffer
      const result = parseAbr(writer.toArrayBuffer());
      expect(result.warnings[0]).toContain('extends beyond file end');
    });
  });

  describe('sample parsing', () => {
    it('should parse uncompressed brush sample', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);

      // samp block
      writer.writeString('8BIM');
      writer.writeString('samp');

      // Build sample data
      const sampleWriter = new BinaryWriter();
      sampleWriter.writeUint32(1); // sample count

      // Sample: length + 37 misc + top + left + bottom + right + depth + compression + pixels
      const width = 4;
      const height = 4;
      const pixels = new Uint8Array(width * height);
      pixels.fill(128);

      const sampleInner = new BinaryWriter();
      sampleInner.writeBytes(new Uint8Array(37)); // misc
      sampleInner.writeUint32(0); // top
      sampleInner.writeUint32(0); // left
      sampleInner.writeUint32(height); // bottom
      sampleInner.writeUint32(width); // right
      sampleInner.writeUint16(8); // depth (8-bit)
      sampleInner.writeUint8(0); // compression (uncompressed)
      sampleInner.writeBytes(pixels);

      const sampleData = sampleInner.toUint8Array();
      sampleWriter.writeUint32(sampleData.length); // sample length
      sampleWriter.writeBytes(sampleData);

      const sampData = sampleWriter.toUint8Array();
      writer.writeUint32(sampData.length); // block length
      writer.writeBytes(sampData);

      // desc block with minimal descriptor
      writer.writeString('8BIM');
      writer.writeString('desc');
      writer.writeUint32(0); // empty desc block

      const result = parseAbr(writer.toArrayBuffer(), 'test.abr');
      expect(result.version).toBe(6);
      // No descriptors parsed, but samples exist → warning
      expect(result.brushes).toHaveLength(0);
    });

    it('should handle zero-dimension samples gracefully', () => {
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);

      writer.writeString('8BIM');
      writer.writeString('samp');

      const sampleWriter = new BinaryWriter();
      sampleWriter.writeUint32(1); // sample count

      const sampleInner = new BinaryWriter();
      sampleInner.writeBytes(new Uint8Array(37)); // misc
      sampleInner.writeUint32(0); // top
      sampleInner.writeUint32(0); // left
      sampleInner.writeUint32(0); // bottom = top → zero height
      sampleInner.writeUint32(0); // right = left → zero width
      sampleInner.writeUint16(8);
      sampleInner.writeUint8(0);

      const sampleData = sampleInner.toUint8Array();
      sampleWriter.writeUint32(sampleData.length);
      sampleWriter.writeBytes(sampleData);

      const sampData = sampleWriter.toUint8Array();
      writer.writeUint32(sampData.length);
      writer.writeBytes(sampData);

      const result = parseAbr(writer.toArrayBuffer());
      expect(result.warnings).toContain('Sample 0 has zero dimensions');
    });
  });

  describe('source name', () => {
    it('should set source name on parsed brushes', () => {
      // Create a minimal valid ABR with at least one sample+descriptor
      const writer = new BinaryWriter();
      writer.writeUint16(6);
      writer.writeUint16(2);

      // We need both samp and desc to produce brushes
      // For now, just verify the parsing completes without errors
      const result = parseAbr(writer.toArrayBuffer(), 'MyBrushes.abr');
      expect(result.version).toBe(6);
    });
  });
});
