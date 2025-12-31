// packages/dsl/src/corrections/index.ts
import { Correction } from '../types/compiled.js';

// Chainable correction type - then is both a method and can hold Correction data
type ChainableCorrection = Correction & {
  then: ((next: Correction) => ChainableCorrection) & Partial<Correction>;
};

// Convert a Correction (possibly with nested then chain) into chainable form
function makeChainable(correction: Correction): ChainableCorrection {
  // Create the chainable method
  const thenMethod = function (next: Correction): ChainableCorrection {
    // Find the end of the chain and append
    if (!correction.then) {
      correction.then = next;
    } else {
      let current = correction.then;
      while (current.then) {
        current = current.then;
      }
      current.then = next;
    }
    return makeChainable(correction);
  };

  // If there's a next correction, make the thenMethod also carry its data
  if (correction.then) {
    const chainedData = makeChainable(correction.then);
    Object.assign(thenMethod, chainedData);
  }

  // Build the result object
  const result = {
    type: correction.type,
    message: correction.message,
    to: correction.to,
    max: correction.max,
    backoff: correction.backoff,
    preserveTypes: correction.preserveTypes,
    then: thenMethod,
  } as ChainableCorrection;

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
    return makeChainable({
      type: 'block',
      message,
    });
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
    return makeChainable({
      type: 'retry',
      max: options.max,
      backoff: options.backoff,
    });
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
