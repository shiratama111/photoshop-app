import { describe, expect, it, vi } from 'vitest';
import { EventBusImpl } from './event-bus';

describe('EventBusImpl', () => {
  // ── on / emit ────────────────────────────────────────────────────────

  it('calls listener when event is emitted with payload', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('layer:added', cb);
    bus.emit('layer:added', { layer: {} as never, parentId: 'root' });

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ layer: {} as never, parentId: 'root' });
  });

  it('calls listener for events with no payload (undefined)', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('document:changed', cb);
    bus.emit('document:changed');

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith();
  });

  it('supports multiple listeners on the same event', () => {
    const bus = new EventBusImpl();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.on('selection:changed', cb1);
    bus.on('selection:changed', cb2);
    bus.emit('selection:changed', { layerId: 'a' });

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('does not fire listeners of other events', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('viewport:changed', cb);
    bus.emit('document:changed');

    expect(cb).not.toHaveBeenCalled();
  });

  // ── off ──────────────────────────────────────────────────────────────

  it('removes a listener via off()', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('document:changed', cb);
    bus.off('document:changed', cb);
    bus.emit('document:changed');

    expect(cb).not.toHaveBeenCalled();
  });

  it('does not throw when removing a listener that was never added', () => {
    const bus = new EventBusImpl();
    expect(() => bus.off('document:changed', vi.fn())).not.toThrow();
  });

  it('does not throw when removing from an event with no listeners', () => {
    const bus = new EventBusImpl();
    expect(() => bus.off('viewport:changed', vi.fn())).not.toThrow();
  });

  // ── unsubscribe function returned by on() ───────────────────────────

  it('returns an unsubscribe function from on()', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    const unsub = bus.on('document:changed', cb);
    unsub();
    bus.emit('document:changed');

    expect(cb).not.toHaveBeenCalled();
  });

  // ── once ─────────────────────────────────────────────────────────────

  it('fires a once() listener only once', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.once('history:pushed', cb);
    bus.emit('history:pushed', { description: 'Add layer' });
    bus.emit('history:pushed', { description: 'Remove layer' });

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ description: 'Add layer' });
  });

  it('can remove a once() listener before it fires via off()', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.once('document:changed', cb);
    bus.off('document:changed', cb);
    bus.emit('document:changed');

    expect(cb).not.toHaveBeenCalled();
  });

  it('can remove a once() listener via returned unsubscribe', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    const unsub = bus.once('document:changed', cb);
    unsub();
    bus.emit('document:changed');

    expect(cb).not.toHaveBeenCalled();
  });

  // ── clear ────────────────────────────────────────────────────────────

  it('removes all listeners via clear()', () => {
    const bus = new EventBusImpl();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.on('document:changed', cb1);
    bus.on('viewport:changed', cb2);
    bus.clear();

    bus.emit('document:changed');
    bus.emit('viewport:changed');

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  // ── memory-leak prevention ──────────────────────────────────────────

  it('cleans up empty listener sets after off()', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('document:changed', cb);
    bus.off('document:changed', cb);

    // Access private map to verify cleanup (cast for test introspection)
    const map = (bus as unknown as { listeners: Map<string, Set<(...args: unknown[]) => void>> }).listeners;
    expect(map.has('document:changed')).toBe(false);
  });

  it('cleans up empty listener sets after once() fires', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.once('document:changed', cb);
    bus.emit('document:changed');

    const map = (bus as unknown as { listeners: Map<string, Set<(...args: unknown[]) => void>> }).listeners;
    expect(map.has('document:changed')).toBe(false);
  });

  it('cleans up onceWrappers map after once() fires', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.once('document:changed', cb);
    bus.emit('document:changed');

    const wrappers = (bus as unknown as { onceWrappers: Map<(...args: unknown[]) => void, (...args: unknown[]) => void> }).onceWrappers;
    expect(wrappers.size).toBe(0);
  });

  it('cleans up onceWrappers map after off() on a once listener', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.once('document:changed', cb);
    bus.off('document:changed', cb);

    const wrappers = (bus as unknown as { onceWrappers: Map<(...args: unknown[]) => void, (...args: unknown[]) => void> }).onceWrappers;
    expect(wrappers.size).toBe(0);
  });

  // ── emission during emission ────────────────────────────────────────

  it('does not break when a listener removes itself during emission', () => {
    const bus = new EventBusImpl();
    const cb1 = vi.fn(() => bus.off('document:changed', cb1));
    const cb2 = vi.fn();

    bus.on('document:changed', cb1);
    bus.on('document:changed', cb2);
    bus.emit('document:changed');

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('does not call a listener added during emission', () => {
    const bus = new EventBusImpl();
    const late = vi.fn();
    const cb = vi.fn(() => bus.on('document:changed', late));

    bus.on('document:changed', cb);
    bus.emit('document:changed');

    expect(cb).toHaveBeenCalledOnce();
    expect(late).not.toHaveBeenCalled();
  });

  // ── type safety (compile-time, verified at runtime via usage) ──────

  it('emits typed payloads correctly', () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();

    bus.on('layer:removed', cb);
    bus.emit('layer:removed', { layerId: 'layer-1', parentId: 'root' });

    expect(cb).toHaveBeenCalledWith({ layerId: 'layer-1', parentId: 'root' });
  });

  it('handles all event types from EventMap', () => {
    const bus = new EventBusImpl();
    const results: string[] = [];

    bus.on('document:changed', () => results.push('document:changed'));
    bus.on('layer:added', () => results.push('layer:added'));
    bus.on('layer:removed', () => results.push('layer:removed'));
    bus.on('layer:reordered', () => results.push('layer:reordered'));
    bus.on('layer:property-changed', () => results.push('layer:property-changed'));
    bus.on('selection:changed', () => results.push('selection:changed'));
    bus.on('history:pushed', () => results.push('history:pushed'));
    bus.on('history:undone', () => results.push('history:undone'));
    bus.on('history:redone', () => results.push('history:redone'));
    bus.on('viewport:changed', () => results.push('viewport:changed'));

    bus.emit('document:changed');
    bus.emit('layer:added', { layer: {} as never, parentId: 'root' });
    bus.emit('layer:removed', { layerId: 'a', parentId: 'root' });
    bus.emit('layer:reordered', { parentId: 'root' });
    bus.emit('layer:property-changed', { layerId: 'a', property: 'name' });
    bus.emit('selection:changed', { layerId: null });
    bus.emit('history:pushed', { description: 'test' });
    bus.emit('history:undone', { description: 'test' });
    bus.emit('history:redone', { description: 'test' });
    bus.emit('viewport:changed');

    expect(results).toEqual([
      'document:changed',
      'layer:added',
      'layer:removed',
      'layer:reordered',
      'layer:property-changed',
      'selection:changed',
      'history:pushed',
      'history:undone',
      'history:redone',
      'viewport:changed',
    ]);
  });
});
