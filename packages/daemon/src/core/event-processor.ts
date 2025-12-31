// packages/daemon/src/core/event-processor.ts
import type { TrajectoryEvent, Violation } from '../checkers/types.js';
import type { Correction } from '../corrections/applicator.js';

/**
 * Interface for trajectory logging
 */
interface TrajectoryLoggerLike {
  log(event: TrajectoryEvent): Promise<void>;
}

/**
 * Interface for state management
 */
interface StateManagerLike {
  load(): Promise<unknown>;
}

/**
 * Interface for checker chain
 */
interface CheckerChainLike {
  check(
    agentId: string,
    event: TrajectoryEvent,
    state: unknown,
    trajectory?: TrajectoryEvent[]
  ): Violation | null;
}

/**
 * Interface for correction applicator
 */
interface CorrectionApplicatorLike {
  apply(agentId: string, correction: Correction): Promise<{ blocked: boolean; message?: string | undefined }>;
}

/**
 * Dependencies for EventProcessor
 */
export interface EventProcessorDeps {
  trajectory: TrajectoryLoggerLike;
  stateManager: StateManagerLike;
  checkerChain: CheckerChainLike | null;
  correctionApplicator: CorrectionApplicatorLike | null;
}

/**
 * Result of processing an event
 */
export interface ProcessEventResult {
  violation?: Violation;
  correction?: Correction;
}

/**
 * EventProcessor service
 *
 * Responsible for:
 * - Logging events to trajectory
 * - Checking invariants via checker chain
 * - Applying corrections when violations are detected
 * - Maintaining trajectory history
 */
export class EventProcessor {
  private readonly trajectory: TrajectoryLoggerLike;
  private readonly stateManager: StateManagerLike;
  private readonly checkerChain: CheckerChainLike | null;
  private readonly correctionApplicator: CorrectionApplicatorLike | null;
  private readonly trajectoryHistory: TrajectoryEvent[] = [];

  constructor(deps: EventProcessorDeps) {
    this.trajectory = deps.trajectory;
    this.stateManager = deps.stateManager;
    this.checkerChain = deps.checkerChain;
    this.correctionApplicator = deps.correctionApplicator;
  }

  /**
   * Process an agent event
   *
   * 1. Logs event to trajectory
   * 2. Checks invariants via checker chain
   * 3. Applies correction if violation detected
   */
  async process(agentId: string, event: TrajectoryEvent): Promise<ProcessEventResult> {
    // 1. Log event to trajectory
    await this.trajectory.log(event);
    this.trajectoryHistory.push(event);

    // 2. Check invariants via CheckerChain
    if (this.checkerChain) {
      const state = await this.stateManager.load();
      const violation = this.checkerChain.check(
        agentId,
        event,
        state,
        this.trajectoryHistory
      );

      // 3. If violation, apply correction if available
      if (violation) {
        const correction = violation.correction;
        if (correction && this.correctionApplicator) {
          await this.correctionApplicator.apply(agentId, correction);
          return { violation, correction };
        }
        return { violation };
      }
    }

    return {};
  }

  /**
   * Get the trajectory history
   */
  getTrajectoryHistory(): TrajectoryEvent[] {
    return [...this.trajectoryHistory];
  }

  /**
   * Clear the trajectory history
   */
  clearTrajectoryHistory(): void {
    this.trajectoryHistory.length = 0;
  }
}
