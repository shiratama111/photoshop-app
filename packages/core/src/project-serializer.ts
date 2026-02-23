/**
 * @module project-serializer
 * Converts between Document (runtime model) and ProjectFile (serialization format).
 * Handles layer tree recursion, PNG encoding of pixel data, and property extraction.
 *
 * @see CORE-003: Project file (.psxp) implementation
 * @see {@link @photoshop-app/types!ProjectFile} — serialization format types
 * @see {@link @photoshop-app/types!Document} — runtime document model
 */

import type {
  Document,
  Layer,
  LayerGroup,
  LayerMask,
  ProjectFile,
  ProjectLayerNode,
  ProjectManifest,
  RasterLayer,
  TextLayer,
} from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import { encodePng, decodePng } from './png-codec';
import { generateId } from './uuid';

/**
 * Converts a Document to a ProjectFile for serialization.
 *
 * @param document - The runtime Document to serialize.
 * @returns A ProjectFile containing the manifest and binary files.
 */
export function documentToProjectFile(document: Document): ProjectFile {
  const files = new Map<string, Uint8Array>();

  const layerTree = serializeChildren(document.rootGroup.children, files);

  const manifest: ProjectManifest = {
    version: 1,
    canvas: document.canvas,
    layerTree,
    createdAt: document.createdAt,
    modifiedAt: document.modifiedAt,
  };

  return { manifest, files };
}

/**
 * Converts a ProjectFile back into a Document.
 *
 * @param projectFile - The ProjectFile to deserialize.
 * @returns A reconstructed Document instance.
 */
export function projectFileToDocument(projectFile: ProjectFile): Document {
  const { manifest, files } = projectFile;

  const rootGroup: LayerGroup = {
    id: generateId(),
    name: 'Root',
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    children: [],
    expanded: true,
  };

  rootGroup.children = deserializeChildren(manifest.layerTree, files, rootGroup.id);

  return {
    id: generateId(),
    name: 'Untitled',
    canvas: manifest.canvas,
    rootGroup,
    selectedLayerId: null,
    filePath: null,
    dirty: false,
    createdAt: manifest.createdAt,
    modifiedAt: manifest.modifiedAt,
  };
}

// ── Serialization helpers ──

function serializeChildren(
  children: Layer[],
  files: Map<string, Uint8Array>,
): ProjectLayerNode[] {
  return children.map((layer) => serializeLayer(layer, files));
}

function serializeLayer(
  layer: Layer,
  files: Map<string, Uint8Array>,
): ProjectLayerNode {
  const node: ProjectLayerNode = {
    id: layer.id,
    type: layer.type,
    name: layer.name,
    properties: serializeBaseProperties(layer),
  };

  switch (layer.type) {
    case 'raster': {
      const raster = layer as RasterLayer;
      if (raster.imageData) {
        const path = `layers/${layer.id}.png`;
        const rgbaData = new Uint8Array(raster.imageData.data.buffer, raster.imageData.data.byteOffset, raster.imageData.data.byteLength);
        files.set(path, encodePng({
          data: rgbaData,
          width: raster.imageData.width,
          height: raster.imageData.height,
        }));
        node.imagePath = path;
      }
      node.properties.bounds = raster.bounds;
      break;
    }
    case 'text': {
      const text = layer as TextLayer;
      node.properties.text = text.text;
      node.properties.fontFamily = text.fontFamily;
      node.properties.fontSize = text.fontSize;
      node.properties.color = text.color;
      node.properties.bold = text.bold;
      node.properties.italic = text.italic;
      node.properties.alignment = text.alignment;
      node.properties.lineHeight = text.lineHeight;
      node.properties.letterSpacing = text.letterSpacing;
      node.properties.textBounds = text.textBounds;
      break;
    }
    case 'group': {
      const group = layer as LayerGroup;
      node.children = serializeChildren(group.children, files);
      node.properties.expanded = group.expanded;
      break;
    }
  }

  // Serialize mask if present
  if (layer.mask) {
    const maskPath = `masks/${layer.id}.png`;
    const maskRgba = maskToRgba(layer.mask);
    files.set(maskPath, encodePng({
      data: maskRgba,
      width: layer.mask.width,
      height: layer.mask.height,
    }));
    node.properties.maskPath = maskPath;
    node.properties.maskWidth = layer.mask.width;
    node.properties.maskHeight = layer.mask.height;
    node.properties.maskOffset = layer.mask.offset;
    node.properties.maskEnabled = layer.mask.enabled;
  }

  return node;
}

function serializeBaseProperties(layer: Layer): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  props.visible = layer.visible;
  props.opacity = layer.opacity;
  props.blendMode = layer.blendMode;
  props.position = layer.position;
  props.locked = layer.locked;
  if (layer.effects.length > 0) {
    props.effects = layer.effects;
  }
  return props;
}

/** Converts single-channel mask data to RGBA (gray→RGBA). */
function maskToRgba(mask: LayerMask): Uint8Array {
  const rgba = new Uint8Array(mask.width * mask.height * 4);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

// ── Deserialization helpers ──

function deserializeChildren(
  nodes: ProjectLayerNode[],
  files: Map<string, Uint8Array>,
  parentId: string,
): Layer[] {
  return nodes.map((node) => deserializeLayer(node, files, parentId));
}

function deserializeLayer(
  node: ProjectLayerNode,
  files: Map<string, Uint8Array>,
  parentId: string,
): Layer {
  const props = node.properties;
  const mask = deserializeMask(node, files);

  const base = {
    id: node.id,
    name: node.name,
    visible: (props.visible as boolean) ?? true,
    opacity: (props.opacity as number) ?? 1,
    blendMode: (props.blendMode as BlendMode) ?? BlendMode.Normal,
    position: (props.position as { x: number; y: number }) ?? { x: 0, y: 0 },
    locked: (props.locked as boolean) ?? false,
    effects: (props.effects as Layer['effects']) ?? [],
    parentId,
    ...(mask ? { mask } : {}),
  };

  switch (node.type) {
    case 'raster': {
      let imageData: ImageData | null = null;
      if (node.imagePath) {
        const pngData = files.get(node.imagePath);
        if (pngData) {
          const decoded = decodePng(pngData);
          // Create a structurally compatible ImageData object (no browser API needed)
          imageData = {
            data: new Uint8ClampedArray(decoded.data),
            width: decoded.width,
            height: decoded.height,
            colorSpace: 'srgb',
          } as ImageData;
        }
      }
      return {
        ...base,
        type: 'raster',
        imageData,
        bounds: (props.bounds as RasterLayer['bounds']) ?? { x: 0, y: 0, width: 0, height: 0 },
      } as RasterLayer;
    }
    case 'text': {
      return {
        ...base,
        type: 'text',
        text: (props.text as string) ?? '',
        fontFamily: (props.fontFamily as string) ?? 'Arial',
        fontSize: (props.fontSize as number) ?? 16,
        color: (props.color as TextLayer['color']) ?? { r: 0, g: 0, b: 0, a: 1 },
        bold: (props.bold as boolean) ?? false,
        italic: (props.italic as boolean) ?? false,
        alignment: (props.alignment as TextLayer['alignment']) ?? 'left',
        lineHeight: (props.lineHeight as number) ?? 1.2,
        letterSpacing: (props.letterSpacing as number) ?? 0,
        textBounds: (props.textBounds as TextLayer['textBounds']) ?? null,
      } as TextLayer;
    }
    case 'group': {
      const group: LayerGroup = {
        ...base,
        type: 'group',
        children: [],
        expanded: (props.expanded as boolean) ?? true,
      } as LayerGroup;
      group.children = deserializeChildren(node.children ?? [], files, group.id);
      return group;
    }
    default:
      throw new Error(`Unknown layer type: ${node.type}`);
  }
}

function deserializeMask(
  node: ProjectLayerNode,
  files: Map<string, Uint8Array>,
): LayerMask | undefined {
  const props = node.properties;
  const maskPath = props.maskPath as string | undefined;
  if (!maskPath) return undefined;

  const pngData = files.get(maskPath);
  if (!pngData) return undefined;

  const decoded = decodePng(pngData);
  // Convert RGBA back to single-channel
  const singleChannel = new Uint8Array(decoded.width * decoded.height);
  for (let i = 0; i < singleChannel.length; i++) {
    singleChannel[i] = decoded.data[i * 4]; // take R channel
  }

  return {
    data: singleChannel,
    width: (props.maskWidth as number) ?? decoded.width,
    height: (props.maskHeight as number) ?? decoded.height,
    offset: (props.maskOffset as { x: number; y: number }) ?? { x: 0, y: 0 },
    enabled: (props.maskEnabled as boolean) ?? true,
  };
}
