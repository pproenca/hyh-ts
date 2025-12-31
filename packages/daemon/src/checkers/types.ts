// packages/daemon/src/checkers/types.ts
import type { Correction } from '@hyh/dsl';
import type { TrajectoryEvent } from '../types/trajectory.js';

export type { TrajectoryEvent };

export interface Violation {
  type: string;
  message: string;
  agentId: string;
  event?: TrajectoryEvent | undefined;
  correction?: Correction | undefined;
}

export interface CheckContext {
  agentId: string;
  event: TrajectoryEvent;
  state: unknown;
  trajectory?: TrajectoryEvent[] | undefined;
}

export interface Checker {
  name: string;
  appliesTo(agentId: string, state: unknown): boolean;
  check(event: TrajectoryEvent, context: CheckContext): Violation | null;
}
