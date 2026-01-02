// packages/dsl/src/invariants/index.ts
import type { Context } from '../types/context.js';
import { Duration, parseDuration } from '../types/primitives.js';
import { TddOptions } from './tdd.js';
import { correctable, CorrectableRule } from './correctable.js';

export { CorrectableRule } from './correctable.js';

export const inv = {
  tdd(options: TddOptions): CorrectableRule {
    return correctable({
      type: 'tdd',
      options: {
        test: options.test,
        impl: options.impl,
        order: options.order ?? ['test', 'impl'],
        commit: options.commit,
      },
    });
  },

  fileScope(getter: (ctx: Context) => string[]): CorrectableRule {
    return correctable({
      type: 'fileScope',
      options: {
        getter: getter.toString(),
      },
    });
  },

  noCode(): CorrectableRule {
    return correctable({
      type: 'noCode',
    });
  },

  readOnly(): CorrectableRule {
    return correctable({
      type: 'readOnly',
    });
  },

  mustReport(format: string): CorrectableRule {
    return correctable({
      type: 'mustReport',
      options: { format },
    });
  },

  mustProgress(timeout: Duration): CorrectableRule {
    return correctable({
      type: 'mustProgress',
      options: { timeout: parseDuration(timeout) },
    });
  },

  externalTodo(options: { file: string; checkBeforeStop: boolean }): CorrectableRule {
    return correctable({
      type: 'externalTodo',
      options,
    });
  },

  contextLimit(options: { max: number; warn?: number }): CorrectableRule {
    return correctable({
      type: 'contextLimit',
      options,
    });
  },
};
