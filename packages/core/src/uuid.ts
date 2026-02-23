/**
 * @module uuid
 * UUID v4 generation utility.
 * Works in both Node.js and browser environments.
 *
 * @see CORE-001: UUID generation
 */

/**
 * Generates a UUID v4 string.
 * Uses `crypto.randomUUID()` which is available in Node.js 19+ and modern browsers.
 *
 * @returns A new UUID v4 string (e.g. "550e8400-e29b-41d4-a716-446655440000").
 */
export function generateId(): string {
  return crypto.randomUUID();
}
