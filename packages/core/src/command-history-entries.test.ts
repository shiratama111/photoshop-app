import { describe, it, expect, vi } from 'vitest';
import { CommandHistoryImpl } from './command-history';
import type { Command } from '@photoshop-app/types';

function mockCommand(desc: string): Command {
  return {
    description: desc,
    execute: vi.fn(),
    undo: vi.fn(),
  };
}

describe('CommandHistoryImpl entries/currentIndex', () => {
  it('entries returns descriptions in execution order', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));
    history.execute(mockCommand('C'));

    expect(history.entries).toEqual(['A', 'B', 'C']);
  });

  it('currentIndex equals number of executed commands', () => {
    const history = new CommandHistoryImpl();
    expect(history.currentIndex).toBe(0);

    history.execute(mockCommand('A'));
    expect(history.currentIndex).toBe(1);

    history.execute(mockCommand('B'));
    expect(history.currentIndex).toBe(2);
  });

  it('currentIndex decreases on undo', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));

    history.undo();
    expect(history.currentIndex).toBe(1);

    history.undo();
    expect(history.currentIndex).toBe(0);
  });

  it('currentIndex increases on redo', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));

    history.undo();
    history.undo();
    expect(history.currentIndex).toBe(0);

    history.redo();
    expect(history.currentIndex).toBe(1);

    history.redo();
    expect(history.currentIndex).toBe(2);
  });

  it('entries includes both undo and redo stack descriptions', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));
    history.execute(mockCommand('C'));

    history.undo(); // undo C
    history.undo(); // undo B

    // undoStack: [A], redoStack: [C, B] (top is B)
    // entries = undoStack + reversed redoStack = ['A', 'B', 'C']
    expect(history.entries).toEqual(['A', 'B', 'C']);
    expect(history.currentIndex).toBe(1);
  });

  it('clear resets entries to empty', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));

    history.clear();

    expect(history.entries).toEqual([]);
    expect(history.currentIndex).toBe(0);
  });

  it('new command after undo discards future entries', () => {
    const history = new CommandHistoryImpl();
    history.execute(mockCommand('A'));
    history.execute(mockCommand('B'));
    history.execute(mockCommand('C'));

    history.undo(); // undo C
    history.undo(); // undo B

    history.execute(mockCommand('D'));

    // A + D, B and C are gone
    expect(history.entries).toEqual(['A', 'D']);
    expect(history.currentIndex).toBe(2);
  });
});
