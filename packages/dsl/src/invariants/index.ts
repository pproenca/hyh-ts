// packages/dsl/src/invariants/index.ts
import { CompiledInvariant } from '../types/compiled.js';
import { Context } from '../types/context.js';
import { Duration, parseDuration } from '../types/primitives.js';
import { tdd, TddOptions } from './tdd.js';

export const inv = {
  tdd(options: TddOptions): CompiledInvariant {
    return tdd(options);
  },

  fileScope(getter: (ctx: Context) => string[]): CompiledInvariant {
    return {
      type: 'fileScope',
      options: {
        getter: getter.toString(),
      },
    };
  },

  noCode(): CompiledInvariant {
    return {
      type: 'noCode',
    };
  },

  readOnly(): CompiledInvariant {
    return {
      type: 'readOnly',
    };
  },

  mustReport(format: string): CompiledInvariant {
    return {
      type: 'mustReport',
      options: { format },
    };
  },

  mustProgress(timeout: Duration): CompiledInvariant {
    return {
      type: 'mustProgress',
      options: { timeout: parseDuration(timeout) },
    };
  },

  externalTodo(options: { file: string; checkBeforeStop: boolean }): CompiledInvariant {
    return {
      type: 'externalTodo',
      options,
    };
  },

  contextLimit(options: { max: number; warn?: number }): CompiledInvariant {
    return {
      type: 'contextLimit',
      options,
    };
  },
};
