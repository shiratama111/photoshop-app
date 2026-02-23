/**
 * @module descriptor-reader
 * Photoshop descriptor format reader for ASL files.
 *
 * ASL files use Photoshop's descriptor format, which is a binary key-value
 * structure with typed values (OSType-based). Descriptors can be nested
 * and contain various primitive types.
 *
 * @see https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_pgfId-1036735
 */

import { BinaryReader } from '@photoshop-app/adapter-abr';

/** Possible value types in a Photoshop descriptor. */
export type DescriptorValue =
  | { type: 'long'; value: number }
  | { type: 'doub'; value: number }
  | { type: 'UntF'; units: string; value: number }
  | { type: 'TEXT'; value: string }
  | { type: 'enum'; typeId: string; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'Objc'; classId: string; items: Map<string, DescriptorValue> }
  | { type: 'VlLs'; items: DescriptorValue[] }
  | { type: 'tdta'; data: Uint8Array }
  | { type: 'unknown'; osType: string };

/** A parsed descriptor — a typed key-value map. */
export interface Descriptor {
  classId: string;
  items: Map<string, DescriptorValue>;
}

/**
 * Read a Photoshop descriptor from the binary reader.
 * @param reader - Binary reader positioned at the start of a descriptor.
 * @returns The parsed descriptor.
 */
export function readDescriptor(reader: BinaryReader): Descriptor {
  const classId = readClassId(reader);
  const itemCount = reader.readUint32();
  const items = new Map<string, DescriptorValue>();

  for (let i = 0; i < itemCount; i++) {
    const key = readKey(reader);
    const value = readValue(reader);
    items.set(key, value);
  }

  return { classId, items };
}

/** Read a class ID (4-byte key or length-prefixed string). */
function readClassId(reader: BinaryReader): string {
  // Unicode name (skip)
  const nameLen = reader.readUint32();
  if (nameLen > 0) {
    reader.skip(nameLen * 2); // UTF-16
  }
  // Class ID
  return readKey(reader);
}

/** Read a key: 4-byte length, if 0 use 4-char key. */
function readKey(reader: BinaryReader): string {
  const length = reader.readUint32();
  if (length === 0) {
    return reader.readString(4);
  }
  return reader.readString(length);
}

/** Read a typed value from the descriptor. */
function readValue(reader: BinaryReader): DescriptorValue {
  const osType = reader.readString(4);

  switch (osType) {
    case 'long':
      return { type: 'long', value: reader.readInt32() };

    case 'doub':
      return { type: 'doub', value: reader.readFloat64() };

    case 'UntF': {
      const units = reader.readString(4);
      const value = reader.readFloat64();
      return { type: 'UntF', units, value };
    }

    case 'TEXT':
      return { type: 'TEXT', value: reader.readUnicodeString() };

    case 'enum': {
      const typeId = readKey(reader);
      const value = readKey(reader);
      return { type: 'enum', typeId, value };
    }

    case 'bool':
      return { type: 'bool', value: reader.readUint8() !== 0 };

    case 'Objc': {
      const desc = readDescriptor(reader);
      return { type: 'Objc', classId: desc.classId, items: desc.items };
    }

    case 'VlLs': {
      const count = reader.readUint32();
      const items: DescriptorValue[] = [];
      for (let i = 0; i < count; i++) {
        items.push(readValue(reader));
      }
      return { type: 'VlLs', items };
    }

    case 'tdta': {
      const length = reader.readUint32();
      const data = reader.readBytes(length);
      return { type: 'tdta', data };
    }

    default:
      return { type: 'unknown', osType };
  }
}

/**
 * Helper to extract a numeric value from a descriptor item.
 * Handles 'long', 'doub', and 'UntF' types.
 */
export function getNumber(items: Map<string, DescriptorValue>, key: string): number | undefined {
  const val = items.get(key);
  if (!val) return undefined;
  if (val.type === 'long') return val.value;
  if (val.type === 'doub') return val.value;
  if (val.type === 'UntF') return val.value;
  return undefined;
}

/**
 * Helper to extract an enum string value from a descriptor item.
 */
export function getEnum(items: Map<string, DescriptorValue>, key: string): string | undefined {
  const val = items.get(key);
  if (!val || val.type !== 'enum') return undefined;
  return val.value;
}

/**
 * Helper to extract a boolean from a descriptor item.
 */
export function getBool(items: Map<string, DescriptorValue>, key: string): boolean | undefined {
  const val = items.get(key);
  if (!val || val.type !== 'bool') return undefined;
  return val.value;
}

/**
 * Helper to extract a nested descriptor (Objc) from a descriptor item.
 */
export function getDescriptor(
  items: Map<string, DescriptorValue>,
  key: string,
): Map<string, DescriptorValue> | undefined {
  const val = items.get(key);
  if (!val || val.type !== 'Objc') return undefined;
  return val.items;
}

/**
 * Helper to extract a color from a descriptor item.
 * Returns {r, g, b, a} with 0-255 channels and 0-1 alpha.
 */
export function getColor(
  items: Map<string, DescriptorValue>,
  key: string,
): { r: number; g: number; b: number; a: number } | undefined {
  const colorDesc = getDescriptor(items, key);
  if (!colorDesc) return undefined;

  const r = getNumber(colorDesc, 'Rd  ') ?? 0;
  const g = getNumber(colorDesc, 'Grn ') ?? 0;
  const b = getNumber(colorDesc, 'Bl  ') ?? 0;

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: 1 };
}
