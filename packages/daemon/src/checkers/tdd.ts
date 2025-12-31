// packages/daemon/src/checkers/tdd.ts
import picomatch from 'picomatch';
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export interface TddCheckerOptions {
  test: string;
  impl: string;
  agentName: string;
}

export class TddChecker implements Checker {
  name = 'tdd';
  private testMatcher: (path: string) => boolean;
  private implMatcher: (path: string) => boolean;
  private agentName: string;

  constructor(options: TddCheckerOptions) {
    this.testMatcher = picomatch(options.test);
    this.implMatcher = picomatch(options.impl);
    this.agentName = options.agentName;
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId.startsWith(this.agentName);
  }

  check(event: TrajectoryEvent, context: CheckContext): Violation | null {
    // Only check tool_use events
    if (event.type !== 'tool_use') return null;

    // Only check Write/Edit tools
    if (event.tool !== 'Write' && event.tool !== 'Edit') return null;

    // Must have a path
    if (!event.path) return null;

    // Test files are always allowed
    if (this.testMatcher(event.path)) {
      return null;
    }

    // Implementation files require prior test write
    if (this.implMatcher(event.path)) {
      const hasTestWrite = this.findTestWrite(context.trajectory ?? []);
      if (!hasTestWrite) {
        return {
          type: 'tdd',
          message: `Implementation file written before test: ${event.path}`,
          agentId: context.agentId,
          event,
          correction: {
            type: 'prompt',
            message: 'Delete implementation. Write failing tests first.',
          },
        };
      }
    }

    return null;
  }

  private findTestWrite(trajectory: TrajectoryEvent[]): boolean {
    return trajectory.some(
      (e) =>
        e.type === 'tool_use' &&
        (e.tool === 'Write' || e.tool === 'Edit') &&
        e.path !== undefined &&
        this.testMatcher(e.path)
    );
  }
}
