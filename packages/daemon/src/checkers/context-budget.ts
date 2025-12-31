// packages/daemon/src/checkers/context-budget.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export interface ContextBudgetOptions {
  max: number;
  warn?: number;
  modelLimit: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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
