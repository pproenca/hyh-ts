// packages/dsl/src/corrections/verbs.ts
import type { Correction } from '../types/compiled.js';

/**
 * Fluent correction verbs shared across rules, heartbeat, gates.
 * Each verb returns the parent builder type T for continued chaining.
 */
export interface CorrectionVerbs<T> {
  blocks(message?: string): T;
  prompts(message: string): T;
  warns(message: string): T;
  restarts(): T;
  reassigns(): T;
  escalates(to: 'orchestrator' | 'human'): T;
  retries(opts: { max: number; backoff?: number }): T;
  compacts(opts: { preserve: string[] }): T;
  uses(correction: Correction): T;
}

/**
 * Chainable correction verbs with .otherwise namespace for fallback chaining.
 */
export interface ChainableCorrectionVerbs<T> extends CorrectionVerbs<T> {
  readonly otherwise: CorrectionVerbs<T>;
}

/**
 * Options for creating a correction verb mixin.
 */
interface CorrectionVerbMixinOptions<T> {
  /** Returns the parent builder after applying correction */
  getParent: () => T;
  /** Gets current correction chain (may be undefined) */
  getCorrection: () => Correction | undefined;
  /** Sets the correction chain */
  setCorrection: (correction: Correction) => void;
}

/**
 * Creates correction verb methods as a mixin.
 * Use this to add fluent correction methods to any builder.
 */
export function createCorrectionVerbMixin<T>(
  options: CorrectionVerbMixinOptions<T>
): ChainableCorrectionVerbs<T> {
  const { getParent, getCorrection, setCorrection } = options;

  /** Appends a correction to the end of the chain */
  function appendCorrection(newCorrection: Correction): T {
    const existing = getCorrection();
    if (!existing) {
      setCorrection(newCorrection);
    } else {
      // Find tail and append
      let current = existing;
      while (current.then) {
        current = current.then;
      }
      current.then = newCorrection;
    }
    return getParent();
  }

  const verbs: CorrectionVerbs<T> = {
    blocks(message?: string): T {
      const correction: Correction = { type: 'block' };
      if (message) {
        correction.message = message;
      }
      return appendCorrection(correction);
    },

    prompts(message: string): T {
      return appendCorrection({ type: 'prompt', message });
    },

    warns(message: string): T {
      return appendCorrection({ type: 'warn', message });
    },

    restarts(): T {
      return appendCorrection({ type: 'restart' });
    },

    reassigns(): T {
      return appendCorrection({ type: 'reassign' });
    },

    escalates(to: 'orchestrator' | 'human'): T {
      return appendCorrection({ type: 'escalate', to });
    },

    retries(opts: { max: number; backoff?: number }): T {
      const correction: Correction = { type: 'retry', max: opts.max };
      if (opts.backoff !== undefined) {
        correction.backoff = opts.backoff;
      }
      return appendCorrection(correction);
    },

    compacts(opts: { preserve: string[] }): T {
      return appendCorrection({ type: 'compact', preserveTypes: opts.preserve });
    },

    uses(correction: Correction): T {
      return appendCorrection(correction);
    },
  };

  // Create chainable version with .otherwise namespace
  const chainable = {
    ...verbs,
    get otherwise(): CorrectionVerbs<T> {
      // .otherwise provides same verbs for fallback chaining
      return verbs;
    },
  };

  return chainable;
}
