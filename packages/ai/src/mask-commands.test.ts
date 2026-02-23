import { describe, it, expect } from 'vitest';
import { BrushMaskCommand, FeatherMaskCommand, AdjustBoundaryCommand } from './mask-commands';
import type { Mask } from '@photoshop-app/types';

/** Create a test mask filled with a given value. */
function createMask(width: number, height: number, fill = 0): Mask {
  return {
    data: new Uint8Array(width * height).fill(fill),
    size: { width, height },
    confidence: 1,
  };
}

describe('BrushMaskCommand', () => {
  it('should apply brush stroke on execute', () => {
    const mask = createMask(10, 10, 0);
    const cmd = new BrushMaskCommand(
      mask,
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    // Before execute, mask should be unchanged
    expect(mask.data[5 * 10 + 5]).toBe(0);

    cmd.execute();
    expect(mask.data[5 * 10 + 5]).toBe(255);
  });

  it('should restore original mask on undo', () => {
    const mask = createMask(10, 10, 0);
    const original = new Uint8Array(mask.data);

    const cmd = new BrushMaskCommand(
      mask,
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    cmd.execute();
    expect(mask.data[5 * 10 + 5]).toBe(255);

    cmd.undo();
    expect(mask.data).toEqual(original);
  });

  it('should support redo (execute after undo)', () => {
    const mask = createMask(10, 10, 0);
    const cmd = new BrushMaskCommand(
      mask,
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    cmd.execute();
    cmd.undo();
    cmd.execute();

    expect(mask.data[5 * 10 + 5]).toBe(255);
  });

  it('should have descriptive description for add mode', () => {
    const mask = createMask(5, 5);
    const cmd = new BrushMaskCommand(
      mask,
      [{ x: 2, y: 2 }],
      { radius: 1, hardness: 1, mode: 'add' },
    );
    expect(cmd.description).toBe('Brush add mask');
  });

  it('should have descriptive description for remove mode', () => {
    const mask = createMask(5, 5, 255);
    const cmd = new BrushMaskCommand(
      mask,
      [{ x: 2, y: 2 }],
      { radius: 1, hardness: 1, mode: 'remove' },
    );
    expect(cmd.description).toBe('Brush remove mask');
  });
});

describe('FeatherMaskCommand', () => {
  it('should feather mask on execute', () => {
    // Sharp edge: top half = 255, bottom half = 0
    const mask = createMask(10, 10, 0);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 10; x++) {
        mask.data[y * 10 + x] = 255;
      }
    }

    const cmd = new FeatherMaskCommand(mask, 2);
    cmd.execute();

    // Edge should now be blurred — row 4 and 5 should have intermediate values
    const edgeValue = mask.data[5 * 10 + 5];
    expect(edgeValue).toBeGreaterThan(0);
    expect(edgeValue).toBeLessThan(255);
  });

  it('should restore original on undo', () => {
    const mask = createMask(10, 10, 0);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 10; x++) {
        mask.data[y * 10 + x] = 255;
      }
    }
    const original = new Uint8Array(mask.data);

    const cmd = new FeatherMaskCommand(mask, 3);
    cmd.execute();
    cmd.undo();

    expect(mask.data).toEqual(original);
  });

  it('should include radius in description', () => {
    const mask = createMask(5, 5);
    const cmd = new FeatherMaskCommand(mask, 5);
    expect(cmd.description).toBe('Feather mask (5px)');
  });
});

describe('AdjustBoundaryCommand', () => {
  it('should expand boundary on execute', () => {
    // Single pixel
    const mask = createMask(11, 11, 0);
    mask.data[5 * 11 + 5] = 255;

    const originalCount = countForeground(mask.data);
    const cmd = new AdjustBoundaryCommand(mask, 2);
    cmd.execute();

    const expandedCount = countForeground(mask.data);
    expect(expandedCount).toBeGreaterThan(originalCount);
  });

  it('should contract boundary on execute', () => {
    // Fill center area
    const mask = createMask(20, 20, 0);
    for (let y = 3; y < 17; y++) {
      for (let x = 3; x < 17; x++) {
        mask.data[y * 20 + x] = 255;
      }
    }

    const originalCount = countForeground(mask.data);
    const cmd = new AdjustBoundaryCommand(mask, -2);
    cmd.execute();

    const contractedCount = countForeground(mask.data);
    expect(contractedCount).toBeLessThan(originalCount);
  });

  it('should restore original on undo', () => {
    const mask = createMask(11, 11, 0);
    mask.data[5 * 11 + 5] = 255;
    const original = new Uint8Array(mask.data);

    const cmd = new AdjustBoundaryCommand(mask, 3);
    cmd.execute();
    cmd.undo();

    expect(mask.data).toEqual(original);
  });

  it('should describe expand correctly', () => {
    const mask = createMask(5, 5);
    const cmd = new AdjustBoundaryCommand(mask, 3);
    expect(cmd.description).toBe('Expand mask boundary (3px)');
  });

  it('should describe contract correctly', () => {
    const mask = createMask(5, 5);
    const cmd = new AdjustBoundaryCommand(mask, -2);
    expect(cmd.description).toBe('Contract mask boundary (2px)');
  });
});

/** Count foreground pixels (value === 255) in a mask. */
function countForeground(data: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 255) count++;
  }
  return count;
}
