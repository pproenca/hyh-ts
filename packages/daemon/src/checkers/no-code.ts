// packages/daemon/src/checkers/no-code.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

const CODE_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h'];

export class NoCodeChecker implements Checker {
  name = 'noCode';
  private readonly agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId === this.agentId;
  }

  check(event: TrajectoryEvent, _context: CheckContext): Violation | null {
    if (event.type !== 'tool_use') return null;

    const tool = event.tool;
    if (tool !== 'Write' && tool !== 'Edit') return null;

    const path = event.path;
    if (!path) return null;

    const isCodeFile = CODE_EXTENSIONS.some(ext => path.endsWith(ext));
    if (isCodeFile) {
      return {
        type: 'noCode',
        message: `Code modification not allowed: ${path}`,
        agentId: this.agentId,
      };
    }

    return null;
  }
}
