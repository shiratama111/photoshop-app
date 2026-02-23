import { describe, it, expect } from 'vitest';
import { parseAsl } from './parse-asl';
import { mapEffect, mapEffects } from './effect-mapper';
import type { DescriptorValue } from './descriptor-reader';

/** Helper to build a big-endian buffer from simple writes. */
class AslWriter {
  private chunks: Uint8Array[] = [];

  writeUint8(value: number): void {
    this.chunks.push(new Uint8Array([value & 0xff]));
  }

  writeUint16(value: number): void {
    this.chunks.push(new Uint8Array([(value >> 8) & 0xff, value & 0xff]));
  }

  writeUint32(value: number): void {
    this.chunks.push(
      new Uint8Array([
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
      ]),
    );
  }

  writeString(str: string): void {
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      buf[i] = str.charCodeAt(i);
    }
    this.chunks.push(buf);
  }

  toArrayBuffer(): ArrayBuffer {
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result.buffer;
  }
}

describe('parseAsl', () => {
  describe('validation', () => {
    it('should reject empty buffer', () => {
      const result = parseAsl(new ArrayBuffer(0));
      expect(result.styles).toHaveLength(0);
      expect(result.warnings[0]).toContain('too small');
    });

    it('should reject too-small buffer', () => {
      const result = parseAsl(new ArrayBuffer(5));
      expect(result.styles).toHaveLength(0);
      expect(result.warnings[0]).toContain('too small');
    });

    it('should reject invalid signature', () => {
      const writer = new AslWriter();
      writer.writeString('XXXX');
      writer.writeUint16(2);
      writer.writeUint32(0);
      const result = parseAsl(writer.toArrayBuffer());
      expect(result.styles).toHaveLength(0);
      expect(result.warnings[0]).toContain('Invalid ASL signature');
    });

    it('should warn on unexpected version', () => {
      const writer = new AslWriter();
      writer.writeString('8BSL');
      writer.writeUint16(99);
      writer.writeUint32(0);
      const result = parseAsl(writer.toArrayBuffer());
      expect(result.warnings[0]).toContain('Unexpected ASL version');
    });

    it('should handle ASL with zero styles', () => {
      const writer = new AslWriter();
      writer.writeString('8BSL');
      writer.writeUint16(2);
      writer.writeUint32(0); // 0 styles
      const result = parseAsl(writer.toArrayBuffer());
      expect(result.styles).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('mapEffect', () => {
  describe('DropShadow (DrSh)', () => {
    it('should map basic drop shadow', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: true });
      items.set('Opct', { type: 'UntF', units: '#Prc', value: 75 });
      items.set('lagl', { type: 'UntF', units: '#Ang', value: 120 });
      items.set('Dstn', { type: 'UntF', units: '#Pxl', value: 5 });
      items.set('blur', { type: 'UntF', units: '#Pxl', value: 10 });
      items.set('Ckmt', { type: 'UntF', units: '#Pxl', value: 0 });

      const result = mapEffect('DrSh', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('drop-shadow');
        const ds = result.effect as { opacity: number; angle: number; distance: number };
        expect(ds.opacity).toBeCloseTo(0.75, 2);
        expect(ds.angle).toBe(120);
        expect(ds.distance).toBe(5);
      }
    });

    it('should handle disabled drop shadow', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: false });

      const result = mapEffect('DrSh', items);
      if ('effect' in result) {
        expect(result.effect.enabled).toBe(false);
      }
    });
  });

  describe('OuterGlow (OrGl)', () => {
    it('should map outer glow', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: true });
      items.set('Opct', { type: 'UntF', units: '#Prc', value: 50 });
      items.set('blur', { type: 'UntF', units: '#Pxl', value: 8 });

      const result = mapEffect('OrGl', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('outer-glow');
      }
    });
  });

  describe('Stroke (FrFX)', () => {
    it('should map stroke with inside position', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: true });
      items.set('Sz  ', { type: 'UntF', units: '#Pxl', value: 3 });
      items.set('Styl', { type: 'enum', typeId: 'FStl', value: 'InsF' });
      items.set('Opct', { type: 'UntF', units: '#Prc', value: 100 });

      const result = mapEffect('FrFX', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('stroke');
        const s = result.effect as { position: string; size: number };
        expect(s.position).toBe('inside');
        expect(s.size).toBe(3);
      }
    });
  });

  describe('unsupported effects', () => {
    it('should skip Inner Shadow', () => {
      const items = new Map<string, DescriptorValue>();
      const result = mapEffect('IrSh', items);
      expect('skipped' in result).toBe(true);
      if ('skipped' in result) {
        expect(result.skipped).toBe('Inner Shadow');
      }
    });

    it('should skip Bevel and Emboss', () => {
      const items = new Map<string, DescriptorValue>();
      const result = mapEffect('BvlE', items);
      expect('skipped' in result).toBe(true);
      if ('skipped' in result) {
        expect(result.skipped).toBe('Bevel and Emboss');
      }
    });

    it('should skip unknown effect keys', () => {
      const items = new Map<string, DescriptorValue>();
      const result = mapEffect('ZZZZ', items);
      expect('skipped' in result).toBe(true);
    });
  });
});

describe('mapEffects', () => {
  it('should map mixed supported and unsupported effects', () => {
    const entries = [
      { key: 'DrSh', items: new Map<string, DescriptorValue>() },
      { key: 'IrSh', items: new Map<string, DescriptorValue>() },
      { key: 'FrFX', items: new Map<string, DescriptorValue>() },
      { key: 'BvlE', items: new Map<string, DescriptorValue>() },
    ];

    const result = mapEffects(entries);
    expect(result.effects).toHaveLength(2); // DrSh + FrFX
    expect(result.skipped).toHaveLength(2); // IrSh + BvlE
    expect(result.effects[0].type).toBe('drop-shadow');
    expect(result.effects[1].type).toBe('stroke');
  });

  it('should handle empty list', () => {
    const result = mapEffects([]);
    expect(result.effects).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
