/**
 * @photoshop-app/core
 *
 * Core document model, command history, and layer management.
 *
 * @packageDocumentation
 */

// UUID generation — CORE-001
export { generateId } from './uuid';

// Document creation — CORE-001
export { createDocument } from './document';

// Layer factories — CORE-001
export { createRasterLayer, createTextLayer, createLayerGroup } from './layer-factory';
export type { CreateTextLayerOptions } from './layer-factory';

// Layer tree operations — CORE-001
export {
  addLayer,
  removeLayer,
  reorderLayer,
  findLayerById,
  findParentGroup,
  traverseLayers,
  flattenLayers,
} from './layer-tree';

// Command history (undo/redo) — CORE-002
export { CommandHistoryImpl } from './command-history';

// Event bus — CORE-004
export { EventBusImpl } from './event-bus';

// Concrete commands — CORE-002
export {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  SetLayerPropertyCommand,
  ModifyPixelsCommand,
} from './commands';

// Project file save/load — CORE-003
export { serialize, deserialize } from './project-file';
export { documentToProjectFile, projectFileToDocument } from './project-serializer';
export { encodePng, decodePng } from './png-codec';
export type { RgbaImage } from './png-codec';
