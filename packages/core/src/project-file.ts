/**
 * @module project-file
 * Public API for .psxp project file serialization.
 * Packs/unpacks a Document into/from a ZIP-based Uint8Array.
 *
 * @see CORE-003: Project file (.psxp) implementation
 * @see https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT — ZIP format spec
 *
 * Dependencies:
 * - fflate: ZIP compression/decompression (sync API)
 * - project-serializer: Document ↔ ProjectFile conversion
 */

import { zipSync, unzipSync } from 'fflate';
import type { Document } from '@photoshop-app/types';
import { documentToProjectFile, projectFileToDocument } from './project-serializer';

/**
 * Serializes a Document into a ZIP-based .psxp file.
 *
 * @param document - The Document to serialize.
 * @returns ZIP file data as Uint8Array.
 */
export function serialize(document: Document): Uint8Array {
  const projectFile = documentToProjectFile(document);

  // Build the ZIP entries
  const entries: Record<string, Uint8Array> = {};

  // manifest.json
  const manifestJson = JSON.stringify(projectFile.manifest, null, 2);
  entries['manifest.json'] = new TextEncoder().encode(manifestJson);

  // Binary files (layer PNGs, mask PNGs)
  for (const [path, data] of projectFile.files) {
    entries[path] = data;
  }

  return zipSync(entries);
}

/**
 * Deserializes a .psxp ZIP file back into a Document.
 *
 * @param data - ZIP file data.
 * @returns The reconstructed Document.
 * @throws If the ZIP does not contain a manifest.json.
 */
export function deserialize(data: Uint8Array): Document {
  const entries = unzipSync(data);

  // Extract manifest
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) {
    throw new Error('Invalid .psxp file: missing manifest.json');
  }

  const manifestJson = new TextDecoder().decode(manifestBytes);
  const manifest = JSON.parse(manifestJson);

  // Build files map (exclude manifest)
  const files = new Map<string, Uint8Array>();
  for (const [path, fileData] of Object.entries(entries)) {
    if (path !== 'manifest.json') {
      files.set(path, fileData);
    }
  }

  return projectFileToDocument({ manifest, files });
}
