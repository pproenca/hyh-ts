// packages/daemon/src/checkers/phase-tool.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';
import type { CompiledPhase } from '@hyh/dsl';

export class PhaseToolChecker implements Checker {
  name = 'phase-tool';
  private readonly phase: CompiledPhase;

  constructor(phase: CompiledPhase) {
    this.phase = phase;
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId.startsWith(this.phase.agent);
  }

  check(event: TrajectoryEvent, context: CheckContext): Violation | null {
    // Only check tool_use events
    if (event.type !== 'tool_use') {
      return null;
    }

    const tool = event.tool;
    if (!tool) return null;

    // Check if tool is forbidden
    if (this.phase.forbids?.includes(tool)) {
      return {
        type: 'forbidden_tool',
        agentId: context.agentId,
        message: `Tool '${tool}' is forbidden in phase '${this.phase.name}'`,
        event,
        correction: {
          type: 'block',
          message: `${tool} is not allowed in ${this.phase.name} phase`,
        },
      };
    }

    // Check if tool is expected (only if expects is non-empty)
    if (this.phase.expects?.length > 0 && !this.phase.expects.includes(tool)) {
      return {
        type: 'unexpected_tool',
        agentId: context.agentId,
        message: `Tool '${tool}' is unusual in phase '${this.phase.name}'`,
        event,
        correction: {
          type: 'warn',
          message: `${tool} is not typically used in ${this.phase.name} phase`,
        },
      };
    }

    return null;
  }
}
