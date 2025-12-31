// packages/daemon/src/checkers/must-progress.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export class MustProgressChecker implements Checker {
  name = 'mustProgress';
  private readonly agentId: string;
  private readonly timeoutMs: number;
  private lastActivity: number;

  constructor(agentId: string, timeoutMs: number) {
    this.agentId = agentId;
    this.timeoutMs = timeoutMs;
    this.lastActivity = Date.now();
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId === this.agentId;
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  check(event: TrajectoryEvent, _context: CheckContext): Violation | null {
    // Any tool use counts as progress
    if (event.type === 'tool_use') {
      this.recordActivity();
    }
    return null;
  }

  checkTimeout(): Violation | null {
    const elapsed = Date.now() - this.lastActivity;
    if (elapsed > this.timeoutMs) {
      return {
        type: 'mustProgress',
        message: `No progress for ${Math.round(elapsed / 1000)}s (timeout: ${Math.round(this.timeoutMs / 1000)}s)`,
        agentId: this.agentId,
      };
    }
    return null;
  }
}
