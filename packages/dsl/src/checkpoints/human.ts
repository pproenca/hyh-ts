// packages/dsl/src/checkpoints/human.ts
import { Checkpoint } from '../types/compiled.js';
import { randomUUID } from 'node:crypto';

interface ApprovalOptions {
  question?: string;
  timeout?: number;
  onTimeout?: 'abort' | 'continue' | 'escalate';
}

export const human = {
  approval(questionOrOptions?: string | ApprovalOptions): Checkpoint {
    const id = randomUUID();

    if (typeof questionOrOptions === 'string') {
      return {
        id,
        type: 'approval',
        question: questionOrOptions,
      };
    }

    if (questionOrOptions) {
      return {
        id,
        type: 'approval',
        question: questionOrOptions.question,
        timeout: questionOrOptions.timeout,
        onTimeout: questionOrOptions.onTimeout,
      };
    }

    return {
      id,
      type: 'approval',
    };
  },
};
