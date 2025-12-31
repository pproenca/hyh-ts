// packages/dsl/src/invariants/tdd.ts
import { CompiledInvariant } from '../types/compiled.js';
import { GlobPattern } from '../types/primitives.js';

export interface TddOptions {
  test: GlobPattern;
  impl: GlobPattern;
  order?: ('test' | 'impl')[];
  commit?: ('test' | 'impl')[];
}

export function tdd(options: TddOptions): CompiledInvariant {
  return {
    type: 'tdd',
    options: {
      test: options.test,
      impl: options.impl,
      order: options.order ?? ['test', 'impl'],
      commit: options.commit,
    },
  };
}
