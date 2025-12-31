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
      const result: Checkpoint = {
        id,
        type: 'approval',
      };
      if (questionOrOptions.question) {
        result.question = questionOrOptions.question;
      }
      if (questionOrOptions.timeout !== undefined) {
        result.timeout = questionOrOptions.timeout;
      }
      if (questionOrOptions.onTimeout) {
        result.onTimeout = questionOrOptions.onTimeout;
      }
      return result;
    }

    return {
      id,
      type: 'approval',
    };
  },
};
