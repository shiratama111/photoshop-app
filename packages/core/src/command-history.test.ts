import { describe, it, expect, vi } from 'vitest';
import { CommandHistoryImpl } from './command-history';
import type { Command } from '@photoshop-app/types';

/** Create a simple mock command with tracked execute/undo calls. */
function mockCommand(desc = 'test'): Command & { execute: ReturnType<typeof vi.fn>; undo: ReturnType<typeof vi.fn> } {
  return {
    description: desc,
    execute: vi.fn(),
    undo: vi.fn(),
  };
}

describe('CommandHistoryImpl', () => {
  it('starts with empty stacks', () => {
    const history = new CommandHistoryImpl();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoDescription).toBeNull();
    expect(history.redoDescription).toBeNull();
  });

  it('has default maxDepth of 50', () => {
    const history = new CommandHistoryImpl();
    expect(history.maxDepth).toBe(50);
  });

  it('accepts a custom maxDepth', () => {
    const history = new CommandHistoryImpl(100);
    expect(history.maxDepth).toBe(100);
  });

  it('throws on maxDepth < 1', () => {
    expect(() => new CommandHistoryImpl(0)).toThrow(RangeError);
    expect(() => new CommandHistoryImpl(-1)).toThrow(RangeError);
  });

  describe('execute', () => {
    it('calls command.execute()', () => {
      const history = new CommandHistoryImpl();
      const cmd = mockCommand();
      history.execute(cmd);
      expect(cmd.execute).toHaveBeenCalledOnce();
    });

    it('enables undo after executing', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand('paint'));
      expect(history.canUndo).toBe(true);
      expect(history.undoDescription).toBe('paint');
    });

    it('clears the redo stack on new command', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand('A'));
      history.undo();
      expect(history.canRedo).toBe(true);

      history.execute(mockCommand('B'));
      expect(history.canRedo).toBe(false);
      expect(history.redoDescription).toBeNull();
    });
  });

  describe('undo', () => {
    it('calls command.undo()', () => {
      const history = new CommandHistoryImpl();
      const cmd = mockCommand();
      history.execute(cmd);
      history.undo();
      expect(cmd.undo).toHaveBeenCalledOnce();
    });

    it('moves command to redo stack', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand('stroke'));
      history.undo();
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(true);
      expect(history.redoDescription).toBe('stroke');
    });

    it('does nothing when undo stack is empty', () => {
      const history = new CommandHistoryImpl();
      history.undo(); // should not throw
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);
    });

    it('undoes multiple commands in LIFO order', () => {
      const history = new CommandHistoryImpl();
      const calls: string[] = [];
      const cmdA: Command = { description: 'A', execute: vi.fn(), undo: () => { calls.push('undo-A'); } };
      const cmdB: Command = { description: 'B', execute: vi.fn(), undo: () => { calls.push('undo-B'); } };
      history.execute(cmdA);
      history.execute(cmdB);

      history.undo();
      history.undo();
      expect(calls).toEqual(['undo-B', 'undo-A']);
    });
  });

  describe('redo', () => {
    it('calls command.execute() again', () => {
      const history = new CommandHistoryImpl();
      const cmd = mockCommand();
      history.execute(cmd);
      history.undo();
      history.redo();
      expect(cmd.execute).toHaveBeenCalledTimes(2);
    });

    it('moves command back to undo stack', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand('fill'));
      history.undo();
      history.redo();
      expect(history.canUndo).toBe(true);
      expect(history.canRedo).toBe(false);
      expect(history.undoDescription).toBe('fill');
    });

    it('does nothing when redo stack is empty', () => {
      const history = new CommandHistoryImpl();
      history.redo(); // should not throw
      expect(history.canRedo).toBe(false);
    });
  });

  describe('maxDepth eviction', () => {
    it('evicts oldest command when exceeding maxDepth', () => {
      const history = new CommandHistoryImpl(3);
      const cmds = Array.from({ length: 4 }, (_, i) => mockCommand(`cmd-${i}`));

      for (const cmd of cmds) {
        history.execute(cmd);
      }

      // Only 3 commands retained
      let undoCount = 0;
      while (history.canUndo) {
        history.undo();
        undoCount++;
      }
      expect(undoCount).toBe(3);

      // cmd-0 was evicted, so its undo was never called
      expect(cmds[0].undo).not.toHaveBeenCalled();
    });

    it('evicts from the bottom of the undo stack', () => {
      const history = new CommandHistoryImpl(2);
      history.execute(mockCommand('first'));
      history.execute(mockCommand('second'));
      history.execute(mockCommand('third'));

      // After eviction, "first" is gone. Top of stack is "third".
      expect(history.undoDescription).toBe('third');
      history.undo();
      expect(history.undoDescription).toBe('second');
      history.undo();
      expect(history.undoDescription).toBeNull();
    });
  });

  describe('clear', () => {
    it('empties both stacks', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand());
      history.execute(mockCommand());
      history.undo();

      history.clear();
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);
    });
  });

  describe('complex undo/redo sequences', () => {
    it('handles undo → redo → undo correctly', () => {
      const history = new CommandHistoryImpl();
      const cmd = mockCommand('move');
      history.execute(cmd);

      history.undo();
      expect(cmd.undo).toHaveBeenCalledTimes(1);

      history.redo();
      expect(cmd.execute).toHaveBeenCalledTimes(2);

      history.undo();
      expect(cmd.undo).toHaveBeenCalledTimes(2);
    });

    it('interleaves multiple undo/redo operations', () => {
      const history = new CommandHistoryImpl();
      history.execute(mockCommand('A'));
      history.execute(mockCommand('B'));
      history.execute(mockCommand('C'));

      history.undo(); // undo C
      history.undo(); // undo B
      expect(history.undoDescription).toBe('A');
      expect(history.redoDescription).toBe('B');

      history.redo(); // redo B
      expect(history.undoDescription).toBe('B');
      expect(history.redoDescription).toBe('C');

      history.execute(mockCommand('D')); // clears redo (C gone)
      expect(history.canRedo).toBe(false);
      expect(history.undoDescription).toBe('D');
    });
  });
});
