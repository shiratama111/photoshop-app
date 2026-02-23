/**
 * @module command
 * Command pattern types for undo/redo support.
 * Each user action is represented as a Command that can be executed and reversed.
 */

/** A reversible command that modifies the document. */
export interface Command {
  /** Human-readable description of the command (for undo/redo menu). */
  readonly description: string;
  /** Execute the command (apply the change). */
  execute(): void;
  /** Reverse the command (undo the change). */
  undo(): void;
}

/** Manages a stack of commands for undo/redo functionality. */
export interface CommandHistory {
  /** Maximum number of commands to keep in history. */
  readonly maxDepth: number;
  /** Whether there are commands that can be undone. */
  readonly canUndo: boolean;
  /** Whether there are commands that can be redone. */
  readonly canRedo: boolean;
  /** Description of the next command to undo, or null. */
  readonly undoDescription: string | null;
  /** Description of the next command to redo, or null. */
  readonly redoDescription: string | null;

  /** Execute a command and push it onto the undo stack. Clears the redo stack. */
  execute(command: Command): void;
  /** Undo the most recent command. */
  undo(): void;
  /** Redo the most recently undone command. */
  redo(): void;
  /** Clear all history. */
  clear(): void;
}
