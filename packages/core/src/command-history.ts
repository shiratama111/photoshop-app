/**
 * @module command-history
 * CommandHistory implementation for undo/redo support.
 * Manages a stack of reversible commands with configurable max depth.
 *
 * @see {@link @photoshop-app/types#CommandHistory} for the interface contract
 * @see CORE-002 ticket for acceptance criteria
 */

import type { Command, CommandHistory } from '@photoshop-app/types';

/** Default maximum number of commands retained in history. */
const DEFAULT_MAX_DEPTH = 50;

/**
 * Concrete implementation of {@link CommandHistory}.
 *
 * Maintains separate undo and redo stacks. Executing a new command clears
 * the redo stack. When the undo stack exceeds `maxDepth`, the oldest
 * command is discarded.
 */
export class CommandHistoryImpl implements CommandHistory {
  /** @inheritdoc */
  readonly maxDepth: number;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  /**
   * Create a new CommandHistory.
   * @param maxDepth - Maximum number of commands to keep (default 50).
   */
  constructor(maxDepth: number = DEFAULT_MAX_DEPTH) {
    if (maxDepth < 1) {
      throw new RangeError('maxDepth must be at least 1');
    }
    this.maxDepth = maxDepth;
  }

  /** @inheritdoc */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** @inheritdoc */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** @inheritdoc */
  get undoDescription(): string | null {
    const top = this.undoStack[this.undoStack.length - 1];
    return top ? top.description : null;
  }

  /** @inheritdoc */
  get redoDescription(): string | null {
    const top = this.redoStack[this.redoStack.length - 1];
    return top ? top.description : null;
  }

  /** @inheritdoc */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    // Evict oldest command if over max depth
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  /** @inheritdoc */
  undo(): void {
    const command = this.undoStack.pop();
    if (!command) {
      return;
    }
    command.undo();
    this.redoStack.push(command);
  }

  /** @inheritdoc */
  redo(): void {
    const command = this.redoStack.pop();
    if (!command) {
      return;
    }
    command.execute();
    this.undoStack.push(command);
  }

  /** @inheritdoc */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
