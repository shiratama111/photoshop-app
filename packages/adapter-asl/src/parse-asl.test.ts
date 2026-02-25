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

function units(value: number, unit: string = '#Pxl'): DescriptorValue {
  return { type: 'UntF', units: unit, value };
}

function rgb(r: number, g: number, b: number): DescriptorValue {
  const colorItems = new Map<string, DescriptorValue>();
  colorItems.set('Rd  ', { type: 'doub', value: r });
  colorItems.set('Grn ', { type: 'doub', value: g });
  colorItems.set('Bl  ', { type: 'doub', value: b });
  return { type: 'Objc', classId: 'RGBC', items: colorItems };
}

function gradientStop(r: number, g: number, b: number, location: number): DescriptorValue {
  const stopItems = new Map<string, DescriptorValue>();
  stopItems.set('Clr ', rgb(r, g, b));
  stopItems.set('Lctn', { type: 'long', value: location });
  return { type: 'Objc', classId: 'Clrt', items: stopItems };
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
      items.set('Opct', units(75, '#Prc'));
      items.set('lagl', units(120, '#Ang'));
      items.set('Dstn', units(5));
      items.set('blur', units(10));
      items.set('Ckmt', units(0));

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

  describe('InnerShadow (IrSh)', () => {
    it('should map inner shadow', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('Opct', units(42, '#Prc'));
      items.set('Angl', units(30, '#Ang'));
      items.set('Dstn', units(6));
      items.set('blur', units(12));
      items.set('Ckmt', units(25));

      const result = mapEffect('IrSh', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('inner-shadow');
        const innerShadow = result.effect as {
          opacity: number;
          angle: number;
          distance: number;
          blur: number;
          choke: number;
        };
        expect(innerShadow.opacity).toBeCloseTo(0.42, 2);
        expect(innerShadow.angle).toBe(30);
        expect(innerShadow.distance).toBe(6);
        expect(innerShadow.blur).toBe(12);
        expect(innerShadow.choke).toBe(25);
      }
    });
  });

  describe('OuterGlow (OrGl)', () => {
    it('should map outer glow', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: true });
      items.set('Opct', units(50, '#Prc'));
      items.set('blur', units(8));

      const result = mapEffect('OrGl', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('outer-glow');
      }
    });
  });

  describe('InnerGlow (IrGl)', () => {
    it('should map inner glow and center source', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('Opct', units(80, '#Prc'));
      items.set('blur', units(9));
      items.set('Ckmt', units(10));
      items.set('glwS', { type: 'enum', typeId: 'IGSr', value: 'SrcC' });

      const result = mapEffect('IrGl', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('inner-glow');
        const innerGlow = result.effect as {
          opacity: number;
          size: number;
          choke: number;
          source: string;
        };
        expect(innerGlow.opacity).toBeCloseTo(0.8, 2);
        expect(innerGlow.size).toBe(9);
        expect(innerGlow.choke).toBe(10);
        expect(innerGlow.source).toBe('center');
      }
    });
  });

  describe('ColorOverlay (ChFX)', () => {
    it('should map color overlay', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('Opct', units(60, '#Prc'));
      items.set('Clr ', rgb(12, 34, 56));

      const result = mapEffect('ChFX', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('color-overlay');
        const colorOverlay = result.effect as {
          opacity: number;
          color: { r: number; g: number; b: number };
        };
        expect(colorOverlay.opacity).toBeCloseTo(0.6, 2);
        expect(colorOverlay.color).toMatchObject({ r: 12, g: 34, b: 56 });
      }
    });
  });

  describe('GradientOverlay (GrFl)', () => {
    it('should map radial gradient overlay with stops', () => {
      const gradItems = new Map<string, DescriptorValue>();
      gradItems.set('Intr', { type: 'long', value: 4096 });
      gradItems.set('Clrs', {
        type: 'VlLs',
        items: [gradientStop(255, 0, 0, 0), gradientStop(0, 0, 255, 4096)],
      });

      const items = new Map<string, DescriptorValue>();
      items.set('Type', { type: 'enum', typeId: 'GrdT', value: 'Rdl ' });
      items.set('Opct', units(80, '#Prc'));
      items.set('Angl', units(33, '#Ang'));
      items.set('Rvrs', { type: 'bool', value: true });
      items.set('Scl ', units(130, '#Prc'));
      items.set('Grad', { type: 'Objc', classId: 'Grdn', items: gradItems });

      const result = mapEffect('GrFl', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('gradient-overlay');
        const gradient = result.effect as {
          gradientType: string;
          opacity: number;
          angle: number;
          reverse: boolean;
          scale: number;
          stops: Array<{ position: number; color: { r: number; g: number; b: number } }>;
        };
        expect(gradient.gradientType).toBe('radial');
        expect(gradient.opacity).toBeCloseTo(0.8, 2);
        expect(gradient.angle).toBe(33);
        expect(gradient.reverse).toBe(true);
        expect(gradient.scale).toBe(130);
        expect(gradient.stops).toHaveLength(2);
        expect(gradient.stops[0]).toMatchObject({ position: 0, color: { r: 255, g: 0, b: 0 } });
        expect(gradient.stops[1]).toMatchObject({ position: 1, color: { r: 0, g: 0, b: 255 } });
      }
    });
  });

  describe('Stroke (FrFX)', () => {
    it('should map stroke with inside position', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('enab', { type: 'bool', value: true });
      items.set('Sz  ', units(3));
      items.set('Styl', { type: 'enum', typeId: 'FStl', value: 'InsF' });
      items.set('Opct', units(100, '#Prc'));

      const result = mapEffect('FrFX', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('stroke');
        const stroke = result.effect as { position: string; size: number };
        expect(stroke.position).toBe('inside');
        expect(stroke.size).toBe(3);
      }
    });
  });

  describe('Bevel & Emboss (BvlE)', () => {
    it('should map bevel and emboss style', () => {
      const items = new Map<string, DescriptorValue>();
      items.set('bvlS', { type: 'enum', typeId: 'BESl', value: 'PlEb' });
      items.set('bvlD', { type: 'enum', typeId: 'BESs', value: 'Out ' });
      items.set('srgR', units(250, '#Prc'));
      items.set('blur', units(8));
      items.set('Sftn', units(2));
      items.set('Angl', units(45, '#Ang'));
      items.set('Lald', units(70, '#Ang'));
      items.set('hglC', rgb(255, 220, 180));
      items.set('hglO', units(60, '#Prc'));
      items.set('sdwC', rgb(10, 20, 30));
      items.set('sdwO', units(80, '#Prc'));

      const result = mapEffect('BvlE', items);
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('bevel-emboss');
        const bevel = result.effect as {
          style: string;
          direction: string;
          depth: number;
          size: number;
          soften: number;
          angle: number;
          altitude: number;
          highlightOpacity: number;
          shadowOpacity: number;
        };
        expect(bevel.style).toBe('pillow-emboss');
        expect(bevel.direction).toBe('down');
        expect(bevel.depth).toBe(250);
        expect(bevel.size).toBe(8);
        expect(bevel.soften).toBe(2);
        expect(bevel.angle).toBe(45);
        expect(bevel.altitude).toBe(70);
        expect(bevel.highlightOpacity).toBeCloseTo(0.6, 2);
        expect(bevel.shadowOpacity).toBeCloseTo(0.8, 2);
      }
    });
  });

  describe('unsupported effects', () => {
    it('should skip unknown effect keys', () => {
      const items = new Map<string, DescriptorValue>();
      const result = mapEffect('ZZZZ', items);
      expect('skipped' in result).toBe(true);
    });
  });
});

describe('mapEffects', () => {
  it('should map all supported effects and keep unknown as skipped', () => {
    const entries = [
      { key: 'DrSh', items: new Map<string, DescriptorValue>() },
      { key: 'IrSh', items: new Map<string, DescriptorValue>() },
      { key: 'OrGl', items: new Map<string, DescriptorValue>() },
      { key: 'IrGl', items: new Map<string, DescriptorValue>() },
      { key: 'ChFX', items: new Map<string, DescriptorValue>() },
      { key: 'GrFl', items: new Map<string, DescriptorValue>() },
      { key: 'FrFX', items: new Map<string, DescriptorValue>() },
      { key: 'BvlE', items: new Map<string, DescriptorValue>() },
      { key: 'ZZZZ', items: new Map<string, DescriptorValue>() },
    ];

    const result = mapEffects(entries);
    expect(result.effects).toHaveLength(8);
    expect(result.skipped).toEqual(['ZZZZ']);
  });

  it('should handle empty list', () => {
    const result = mapEffects([]);
    expect(result.effects).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
