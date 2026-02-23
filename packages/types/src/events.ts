/**
 * @module events
 * Type-safe event bus definitions for cross-module communication.
 * All inter-module communication should go through the EventBus.
 */

import type { Layer } from './layer';

/** Map of event names to their payload types. */
export interface EventMap {
  /** Fired when the document model changes (any modification). */
  'document:changed': undefined;
  /** Fired when a layer is added. */
  'layer:added': { layer: Layer; parentId: string };
  /** Fired when a layer is removed. */
  'layer:removed': { layerId: string; parentId: string };
  /** Fired when layers are reordered within a group. */
  'layer:reordered': { parentId: string };
  /** Fired when a layer property changes (name, opacity, visibility, etc.). */
  'layer:property-changed': { layerId: string; property: string };
  /** Fired when the selected layer changes. */
  'selection:changed': { layerId: string | null };
  /** Fired when a command is executed (pushed to history). */
  'history:pushed': { description: string };
  /** Fired when a command is undone. */
  'history:undone': { description: string };
  /** Fired when a command is redone. */
  'history:redone': { description: string };
  /** Fired when the viewport transform changes (zoom/pan). */
  'viewport:changed': undefined;
}

/** Callback function type for event listeners. */
export type EventCallback<K extends keyof EventMap> = EventMap[K] extends undefined
  ? () => void
  : (payload: EventMap[K]) => void;

/** Type-safe event bus for pub/sub communication. */
export interface EventBus {
  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void;
  /** Subscribe to an event for a single emission. */
  once<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void;
  /** Unsubscribe a specific callback from an event. */
  off<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void;
  /** Emit an event with an optional payload. */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]
  ): void;
  /** Remove all listeners for all events. */
  clear(): void;
}
