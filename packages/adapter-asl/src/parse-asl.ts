/**
 * @module parse-asl
 * ASL (Adobe Style Library) file parser.
 *
 * ASL files contain serialized layer style presets using Photoshop's
 * descriptor format. Each style is a collection of effects
 * (drop shadow, outer glow, stroke, etc.).
 *
 * File structure:
 * - Signature: 4 bytes ('8BSL' for ASL files)
 * - Version: 2 bytes (typically 2)
 * - Style count: 4 bytes
 * - For each style: descriptor containing effect sub-descriptors
 *
 * @see {@link @photoshop-app/types!AslParseResult}
 */

import type { AslParseResult, LayerStylePreset } from '@photoshop-app/types';
import { BinaryReader } from '@photoshop-app/adapter-abr';
import { readDescriptor, type DescriptorValue } from './descriptor-reader';
import { mapEffects } from './effect-mapper';

/** Expected file signature. */
const ASL_SIGNATURE = '8BSL';

/**
 * Parse an ASL file buffer into layer style presets.
 * @param buffer - Raw ASL file data.
 * @param sourceName - Optional filename for the `source` field.
 * @returns Parsed styles with warnings.
 */
export function parseAsl(buffer: ArrayBuffer, sourceName?: string): AslParseResult {
  const warnings: string[] = [];
  const styles: LayerStylePreset[] = [];
  const allSkipped: string[] = [];

  if (buffer.byteLength < 10) {
    return { styles: [], skippedEffects: [], warnings: ['File too small to be a valid ASL file'] };
  }

  const reader = new BinaryReader(buffer);

  // Read signature
  const signature = reader.readString(4);
  if (signature !== ASL_SIGNATURE) {
    return {
      styles: [],
      skippedEffects: [],
      warnings: [`Invalid ASL signature: "${signature}" (expected "${ASL_SIGNATURE}")`],
    };
  }

  // Read version
  const version = reader.readUint16();
  if (version !== 2) {
    warnings.push(`Unexpected ASL version ${version} (expected 2)`);
  }

  // Read style count
  const styleCount = reader.readUint32();

  for (let i = 0; i < styleCount && !reader.eof; i++) {
    try {
      const descriptor = readDescriptor(reader);
      const styleName = extractStyleName(descriptor.items) ?? `Style ${i + 1}`;

      // Extract effects from the descriptor
      const effectEntries = extractEffectEntries(descriptor.items);
      const { effects, skipped } = mapEffects(effectEntries);

      styles.push({
        id: crypto.randomUUID(),
        name: styleName,
        effects,
        source: sourceName ?? null,
      });

      allSkipped.push(...skipped);
    } catch {
      warnings.push(`Failed to parse style ${i + 1}`);
      break;
    }
  }

  // Deduplicate skipped effects
  const uniqueSkipped = [...new Set(allSkipped)];

  return { styles, skippedEffects: uniqueSkipped, warnings };
}

/**
 * Extract the style name from the descriptor.
 * The name is typically in the 'Nm  ' key.
 */
function extractStyleName(items: Map<string, DescriptorValue>): string | undefined {
  const name = items.get('Nm  ');
  if (name && name.type === 'TEXT') return name.value;
  return undefined;
}

/**
 * Extract effect entries from a style descriptor.
 * Effects are typically nested under a 'Lefx' or 'lfxv' key
 * as a list of sub-descriptors.
 */
function extractEffectEntries(
  items: Map<string, DescriptorValue>,
): Array<{ key: string; items: Map<string, DescriptorValue> }> {
  const entries: Array<{ key: string; items: Map<string, DescriptorValue> }> = [];

  // Check for 'Lefx' (layer effects) descriptor
  const lefx = items.get('Lefx');
  if (lefx && lefx.type === 'Objc') {
    for (const [key, val] of lefx.items) {
      if (val.type === 'Objc') {
        entries.push({ key, items: val.items });
      }
    }
    return entries;
  }

  // Also check top-level for direct effect keys
  for (const [key, val] of items) {
    if (val.type === 'Objc' && isEffectKey(key)) {
      entries.push({ key, items: val.items });
    }
  }

  return entries;
}

/** Known Photoshop effect descriptor keys. */
const EFFECT_KEYS = new Set([
  'DrSh',
  'IrSh',
  'OrGl',
  'IrGl',
  'ChFX',
  'SoFi',
  'GrFl',
  'patternFill',
  'FrFX',
  'BvlE',
  'ebbl',
]);

function isEffectKey(key: string): boolean {
  return EFFECT_KEYS.has(key);
}
