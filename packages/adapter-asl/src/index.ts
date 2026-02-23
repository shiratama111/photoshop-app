/**
 * @photoshop-app/adapter-asl
 *
 * ASL (Adobe Style Library) file importer.
 * Parses Photoshop layer style preset files and maps effects
 * to internal LayerEffect types.
 *
 * @packageDocumentation
 */

export { parseAsl } from './parse-asl';
export { mapEffect, mapEffects } from './effect-mapper';
export type { DescriptorValue, Descriptor } from './descriptor-reader';
export { readDescriptor, getNumber, getEnum, getBool, getColor } from './descriptor-reader';
