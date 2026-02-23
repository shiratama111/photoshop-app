/**
 * @module event-bus
 * Type-safe pub/sub event emitter for cross-module communication.
 *
 * All inter-module communication should go through the EventBus rather than
 * direct imports, keeping packages decoupled.
 *
 * @see {@link @photoshop-app/types#EventBus} for the interface contract
 * @see {@link @photoshop-app/types#EventMap} for the event catalogue
 * @see CORE-004 ticket for acceptance criteria
 */

import type { EventBus, EventCallback, EventMap } from '@photoshop-app/types';

/**
 * Concrete implementation of {@link EventBus}.
 *
 * Stores listeners in a `Map<string, Set<Function>>` so that add/remove are
 * O(1) and iteration order matches subscription order. The `once` wrapper is
 * tracked separately so that `off` can remove it correctly.
 */
export class EventBusImpl implements EventBus {
  /** Registered listeners keyed by event name. */
  private listeners = new Map<string, Set<Function>>();

  /**
   * Mapping from the original `once` callback supplied by the caller to the
   * internal wrapper that auto-unsubscribes. This lets `off()` remove a
   * `once` listener before it fires.
   */
  private onceWrappers = new Map<Function, Function>();

  /** @inheritdoc */
  on<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void {
    const set = this.getOrCreateSet(event);
    set.add(callback);
    return () => this.off(event, callback);
  }

  /** @inheritdoc */
  once<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, callback);
      (callback as Function)(...args);
    }) as EventCallback<K>;

    this.onceWrappers.set(callback, wrapper);
    const set = this.getOrCreateSet(event);
    set.add(wrapper);

    return () => this.off(event, callback);
  }

  /** @inheritdoc */
  off<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void {
    const set = this.listeners.get(event);
    if (!set) return;

    // Try removing the callback directly (registered via `on`).
    if (set.delete(callback)) {
      this.cleanupSet(event, set);
      return;
    }

    // If it was registered via `once`, remove the wrapper instead.
    const wrapper = this.onceWrappers.get(callback);
    if (wrapper) {
      set.delete(wrapper);
      this.onceWrappers.delete(callback);
      this.cleanupSet(event, set);
    }
  }

  /** @inheritdoc */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;

    // Iterate over a snapshot so that listeners added/removed during
    // emission don't cause issues.
    for (const fn of [...set]) {
      (fn as Function)(...args);
    }
  }

  /** @inheritdoc */
  clear(): void {
    this.listeners.clear();
    this.onceWrappers.clear();
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /** Return the listener set for `event`, creating it if necessary. */
  private getOrCreateSet(event: string): Set<Function> {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    return set;
  }

  /** Delete the set from the map when it becomes empty to avoid leaks. */
  private cleanupSet(event: string, set: Set<Function>): void {
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }
}
