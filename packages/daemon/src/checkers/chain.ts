// packages/daemon/src/checkers/chain.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';
import type { CompiledWorkflow } from '@hyh/dsl';
import { TddChecker } from './tdd.js';
import { FileScopeChecker } from './file-scope.js';
import { TodoChecker } from './todo.js';
import { ContextBudgetChecker } from './context-budget.js';
import { PhaseToolChecker } from './phase-tool.js';

const MODEL_LIMITS: Record<string, number> = {
  sonnet: 200000,
  haiku: 200000,
  opus: 200000,
};

function getModelLimit(model: string): number {
  return MODEL_LIMITS[model] ?? 200000;
}

export class CheckerChain {
  private checkers: Checker[];

  constructor(checkers: Checker[] = []) {
    this.checkers = [...checkers];
  }

  /** Number of checkers in the chain. Exposed as getter to keep checkers array encapsulated. */
  get checkerCount(): number {
    return this.checkers.length;
  }

  static fromWorkflow(workflow: CompiledWorkflow): CheckerChain {
    const checkers: Checker[] = [];

    // Process each agent's rules
    for (const [agentName, agent] of Object.entries(workflow.agents)) {
      for (const invariant of agent.rules) {
        const opts = invariant.options ?? {};

        switch (invariant.type) {
          case 'tdd':
            checkers.push(
              new TddChecker({
                test: opts.test as string,
                impl: opts.impl as string,
                agentName,
              })
            );
            break;

          case 'fileScope':
            checkers.push(
              new FileScopeChecker({
                agentName,
                allowedFiles: JSON.parse(opts.getter as string),
              })
            );
            break;

          case 'externalTodo':
            checkers.push(
              new TodoChecker({
                file: opts.file as string,
                checkBeforeStop: opts.checkBeforeStop as boolean,
              })
            );
            break;

          case 'contextLimit': {
            const budgetOpts: {
              max: number;
              modelLimit: number;
              warn?: number;
            } = {
              max: opts.max as number,
              modelLimit: getModelLimit(agent.model),
            };
            if (opts.warn !== undefined) {
              budgetOpts.warn = opts.warn as number;
            }
            checkers.push(new ContextBudgetChecker(budgetOpts));
            break;
          }
        }
      }
    }

    // Process phases for PhaseToolChecker
    for (const phase of workflow.phases) {
      if (phase.expects.length > 0 || phase.forbids.length > 0) {
        checkers.push(new PhaseToolChecker(phase));
      }
    }

    return new CheckerChain(checkers);
  }

  addChecker(checker: Checker): void {
    this.checkers.push(checker);
  }

  check(
    agentId: string,
    event: TrajectoryEvent,
    state: unknown,
    trajectory?: TrajectoryEvent[]
  ): Violation | null {
    const context: CheckContext = {
      agentId,
      event,
      state,
      trajectory,
    };

    for (const checker of this.checkers) {
      if (checker.appliesTo(agentId, state)) {
        const violation = checker.check(event, context);
        if (violation) {
          return violation;
        }
      }
    }

    return null;
  }
}
