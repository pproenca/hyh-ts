// packages/daemon/src/checkers/context-budget.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';
import { get_encoding } from 'tiktoken';

export interface ContextBudgetOptions {
  max: number;
  warn?: number;
  modelLimit: number;
}

let encoder: ReturnType<typeof get_encoding> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = get_encoding('cl100k_base');
  }
  return encoder;
}

export function estimateTokens(text: string): number {
  try {
    return getEncoder().encode(text).length;
  } catch {
    // Fallback to char/4 if tiktoken fails
    return Math.ceil(text.length / 4);
  }
}

export class ContextBudgetChecker implements Checker {
  name = 'contextBudget';
  private readonly options: ContextBudgetOptions;

  constructor(options: ContextBudgetOptions) {
    this.options = options;
  }

  appliesTo(_agentId: string, _state: unknown): boolean {
    return true;
  }

  check(_event: TrajectoryEvent, ctx: CheckContext): Violation | null {
    const trajectory = ctx.trajectory ?? [];
    let totalTokens = 0;
    for (const event of trajectory) {
      const eventStr = JSON.stringify(event);
      totalTokens += estimateTokens(eventStr);
    }

    const usage = totalTokens / this.options.modelLimit;

    if (usage > this.options.max) {
      return {
        type: 'context_exceeded',
        agentId: ctx.agentId,
        message: `Context at ${Math.round(usage * 100)}% of limit (max ${Math.round(this.options.max * 100)}%)`,
        correction: {
          type: 'prompt',
          message: 'Context limit exceeded. Summarize key decisions and continue.',
        },
      };
    }

    if (this.options.warn && usage > this.options.warn) {
      return {
        type: 'context_warning',
        agentId: ctx.agentId,
        message: `Context at ${Math.round(usage * 100)}% of limit`,
        correction: {
          type: 'warn',
          message: `Context usage high (${Math.round(usage * 100)}%)`,
        },
      };
    }

    return null;
  }
}
