// packages/daemon/src/checkers/todo.ts
import * as fs from 'node:fs';
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export interface TodoCheckerOptions {
  file: string;
  checkBeforeStop: boolean;
}

export class TodoChecker implements Checker {
  name = 'todo';
  private readonly options: TodoCheckerOptions;

  constructor(options: TodoCheckerOptions) {
    this.options = options;
  }

  appliesTo(_agentId: string, _state: unknown): boolean {
    return true;
  }

  check(_event: TrajectoryEvent, context: CheckContext): Violation | null {
    try {
      const content = fs.readFileSync(this.options.file, 'utf-8');
      const incompleteItems = content.match(/- \[ \]/g) || [];

      if (incompleteItems.length > 0) {
        return {
          type: 'incomplete_todo',
          agentId: context.agentId,
          message: `${incompleteItems.length} todo items incomplete. Complete all items before stopping.`,
          correction: {
            type: 'prompt',
            message: 'Complete all todo items before stopping.',
          },
        };
      }

      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
