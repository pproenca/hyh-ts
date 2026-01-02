// packages/dsl/src/corrections/index.ts
import type { Correction } from '../types/compiled.js';

// Store the underlying correction for each chainable (for debugging and serialization)
const underlyingCorrections = new WeakMap<object, Correction>();

/**
 * Chainable correction with .otherwise namespace for fallback chaining.
 * Replaces the old .then() pattern with more semantic naming.
 */
interface ChainableCorrection extends Correction {
  readonly otherwise: OtherwiseNamespace;
}

/**
 * The .otherwise namespace provides all correction factory methods for fallback chaining.
 */
interface OtherwiseNamespace {
  prompts(message: string): ChainableCorrection;
  warns(message: string): ChainableCorrection;
  blocks(message?: string): ChainableCorrection;
  restarts(): ChainableCorrection;
  reassigns(): ChainableCorrection;
  retries(options: { max: number; backoff?: number }): ChainableCorrection;
  escalates(to: 'orchestrator' | 'human'): ChainableCorrection;
  compacts(options: { preserve: string[]; discard?: string[] }): ChainableCorrection;
}

// Debug helper to get the underlying correction
export function getUnderlyingCorrection(chainable: ChainableCorrection): Correction {
  return underlyingCorrections.get(chainable) ?? { type: 'prompt' };
}

/** Appends a correction to the end of the chain */
function appendToChain(base: Correction, next: Correction): Correction {
  if (!base.then) {
    base.then = next;
  } else {
    let current = base.then;
    while (current.then) {
      current = current.then;
    }
    current.then = next;
  }
  return base;
}

/** Creates the .otherwise namespace for a correction */
function createOtherwiseNamespace(base: Correction): OtherwiseNamespace {
  return {
    prompts(message: string): ChainableCorrection {
      appendToChain(base, { type: 'prompt', message });
      return makeChainable(base);
    },
    warns(message: string): ChainableCorrection {
      appendToChain(base, { type: 'warn', message });
      return makeChainable(base);
    },
    blocks(message?: string): ChainableCorrection {
      const correction: Correction = { type: 'block' };
      if (message) {
        correction.message = message;
      }
      appendToChain(base, correction);
      return makeChainable(base);
    },
    restarts(): ChainableCorrection {
      appendToChain(base, { type: 'restart' });
      return makeChainable(base);
    },
    reassigns(): ChainableCorrection {
      appendToChain(base, { type: 'reassign' });
      return makeChainable(base);
    },
    retries(options: { max: number; backoff?: number }): ChainableCorrection {
      const correction: Correction = { type: 'retry', max: options.max };
      if (options.backoff !== undefined) {
        correction.backoff = options.backoff;
      }
      appendToChain(base, correction);
      return makeChainable(base);
    },
    escalates(to: 'orchestrator' | 'human'): ChainableCorrection {
      appendToChain(base, { type: 'escalate', to });
      return makeChainable(base);
    },
    compacts(options: { preserve: string[]; discard?: string[] }): ChainableCorrection {
      appendToChain(base, { type: 'compact', preserveTypes: options.preserve });
      return makeChainable(base);
    },
  };
}

/** Convert a Correction into chainable form with .otherwise namespace */
function makeChainable(correction: Correction): ChainableCorrection {
  // Build the result object with correction properties
  const result: ChainableCorrection = {
    type: correction.type,
    get otherwise(): OtherwiseNamespace {
      return createOtherwiseNamespace(correction);
    },
  };

  // Copy optional fields
  if (correction.message) {
    (result as Correction).message = correction.message;
  }
  if (correction.to) {
    (result as Correction).to = correction.to;
  }
  if (correction.max !== undefined) {
    (result as Correction).max = correction.max;
  }
  if (correction.backoff !== undefined) {
    (result as Correction).backoff = correction.backoff;
  }
  if (correction.preserveTypes) {
    (result as Correction).preserveTypes = correction.preserveTypes;
  }
  if (correction.then) {
    (result as Correction).then = correction.then;
  }

  // Store the underlying correction
  underlyingCorrections.set(result, correction);

  return result;
}

/**
 * Factory for creating chainable corrections.
 * Use .otherwise for fallback chaining.
 * @example
 * correct.prompts('Try again')
 *   .otherwise.restarts()
 *   .otherwise.escalates('human')
 */
export const correct = {
  prompts(message: string): ChainableCorrection {
    return makeChainable({
      type: 'prompt',
      message,
    });
  },

  warns(message: string): ChainableCorrection {
    return makeChainable({
      type: 'warn',
      message,
    });
  },

  blocks(message?: string): ChainableCorrection {
    const correction: Correction = { type: 'block' };
    if (message) {
      correction.message = message;
    }
    return makeChainable(correction);
  },

  restarts(): ChainableCorrection {
    return makeChainable({
      type: 'restart',
    });
  },

  reassigns(): ChainableCorrection {
    return makeChainable({
      type: 'reassign',
    });
  },

  retries(options: { max: number; backoff?: number }): ChainableCorrection {
    const correction: Correction = {
      type: 'retry',
      max: options.max,
    };
    if (options.backoff !== undefined) {
      correction.backoff = options.backoff;
    }
    return makeChainable(correction);
  },

  escalates(to: 'orchestrator' | 'human'): ChainableCorrection {
    return makeChainable({
      type: 'escalate',
      to,
    });
  },

  compacts(options: { preserve: string[]; discard?: string[] }): ChainableCorrection {
    return makeChainable({
      type: 'compact',
      preserveTypes: options.preserve,
    });
  },
};
