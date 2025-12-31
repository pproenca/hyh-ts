// packages/dsl/src/corrections/index.ts
import { Correction } from '../types/compiled.js';

// Store the underlying correction for each chainable (for debugging and serialization)
const underlyingCorrections = new WeakMap<object, Correction>();

// Chainable correction type - then is both callable and has Correction properties
interface ChainableThen {
  (next: Correction): ChainableCorrection;
  type?: Correction['type'];
  message?: string;
  to?: 'orchestrator' | 'human';
  max?: number;
  backoff?: number;
  preserveTypes?: string[];
  then?: ChainableThen;
}

type ChainableCorrection = Correction & {
  then: ChainableThen;
};

// Debug helper to get the underlying correction
export function _getUnderlyingCorrection(chainable: ChainableCorrection): Correction {
  return underlyingCorrections.get(chainable) ?? { type: 'prompt' };
}

// Convert a Correction into chainable form using Proxy for lazy access
function makeChainable(correction: Correction): ChainableCorrection {
  // Create the base chainable method
  const chainMethod = function (next: Correction): ChainableCorrection {
    // If next is a ChainableCorrection, get its underlying Correction
    const nextCorrection = underlyingCorrections.get(next as object) ?? next;

    // Find the end of the chain and append
    if (!correction.then) {
      correction.then = nextCorrection;
    } else {
      let current: Correction = correction.then;
      while (current.then) {
        current = current.then;
      }
      current.then = nextCorrection;
    }
    return makeChainable(correction);
  };

  // Create a proxy that acts as both a function (chainable) and object (correction data)
  const thenProxy = new Proxy(chainMethod, {
    get(target, prop) {
      // Handle function properties
      if (prop === 'call' || prop === 'apply' || prop === 'bind') {
        return (target as unknown as Record<string | symbol, unknown>)[prop];
      }
      // Handle correction.then data access
      if (correction.then) {
        if (prop === 'then') {
          return makeChainable(correction.then).then;
        }
        return (correction.then as unknown as Record<string | symbol, unknown>)[prop];
      }
      return undefined;
    },
    apply(target, thisArg, args) {
      return target.apply(thisArg, args as [Correction]);
    },
  }) as ChainableThen;

  // Build the result object conditionally to avoid undefined values
  // Use type assertion since we're constructing this carefully
  const result = {
    type: correction.type,
    then: thenProxy,
  } as ChainableCorrection;
  if (correction.message) {
    result.message = correction.message;
  }
  if (correction.to) {
    result.to = correction.to;
  }
  if (correction.max !== undefined) {
    result.max = correction.max;
  }
  if (correction.backoff !== undefined) {
    result.backoff = correction.backoff;
  }
  if (correction.preserveTypes) {
    result.preserveTypes = correction.preserveTypes;
  }

  // Store the underlying correction
  underlyingCorrections.set(result, correction);

  return result;
}

export const correct = {
  prompt(message: string): ChainableCorrection {
    return makeChainable({
      type: 'prompt',
      message,
    });
  },

  warn(message: string): ChainableCorrection {
    return makeChainable({
      type: 'warn',
      message,
    });
  },

  block(message?: string): ChainableCorrection {
    const correction: Correction = { type: 'block' };
    if (message) {
      correction.message = message;
    }
    return makeChainable(correction);
  },

  restart(): ChainableCorrection {
    return makeChainable({
      type: 'restart',
    });
  },

  reassign(): ChainableCorrection {
    return makeChainable({
      type: 'reassign',
    });
  },

  retry(options: { max: number; backoff?: number }): ChainableCorrection {
    const correction: Correction = {
      type: 'retry',
      max: options.max,
    };
    if (options.backoff !== undefined) {
      correction.backoff = options.backoff;
    }
    return makeChainable(correction);
  },

  escalate(to: 'orchestrator' | 'human'): ChainableCorrection {
    return makeChainable({
      type: 'escalate',
      to,
    });
  },

  compact(options: { preserve: string[]; discard?: string[] }): ChainableCorrection {
    return makeChainable({
      type: 'compact',
      preserveTypes: options.preserve,
    });
  },
};
