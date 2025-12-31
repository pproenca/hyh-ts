// packages/daemon/src/checkers/chain.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export class CheckerChain {
  private checkers: Checker[];

  constructor(checkers: Checker[] = []) {
    this.checkers = checkers;
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
