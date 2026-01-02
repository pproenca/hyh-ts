// packages/dsl/src/invariants/index.ts
import { CompiledRule } from '../types/compiled.js';
import { Context } from '../types/context.js';
import { Duration, parseDuration } from '../types/primitives.js';
import { tdd, TddOptions } from './tdd.js';

export const inv = {
  tdd(options: TddOptions): CompiledRule {
    return tdd(options);
  },

  fileScope(getter: (ctx: Context) => string[]): CompiledRule {
    return {
      type: 'fileScope',
      options: {
        getter: getter.toString(),
      },
    };
  },

  noCode(): CompiledRule {
    return {
      type: 'noCode',
    };
  },

  readOnly(): CompiledRule {
    return {
      type: 'readOnly',
    };
  },

  mustReport(format: string): CompiledRule {
    return {
      type: 'mustReport',
      options: { format },
    };
  },

  mustProgress(timeout: Duration): CompiledRule {
    return {
      type: 'mustProgress',
      options: { timeout: parseDuration(timeout) },
    };
  },

  externalTodo(options: { file: string; checkBeforeStop: boolean }): CompiledRule {
    return {
      type: 'externalTodo',
      options,
    };
  },

  contextLimit(options: { max: number; warn?: number }): CompiledRule {
    return {
      type: 'contextLimit',
      options,
    };
  },
};
