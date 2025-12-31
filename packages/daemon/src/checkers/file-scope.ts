// packages/daemon/src/checkers/file-scope.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export interface FileScopeCheckerOptions {
  agentName: string;
  allowedFiles: string[];
}

export class FileScopeChecker implements Checker {
  name = 'fileScope';
  private agentName: string;
  private allowedFiles: Set<string>;

  constructor(options: FileScopeCheckerOptions) {
    this.agentName = options.agentName;
    this.allowedFiles = new Set(options.allowedFiles);
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId.startsWith(this.agentName);
  }

  check(event: TrajectoryEvent, context: CheckContext): Violation | null {
    if (event.type !== 'tool_use') return null;
    if (event.tool !== 'Write' && event.tool !== 'Edit') return null;
    if (!event.path) return null;

    if (!this.allowedFiles.has(event.path)) {
      return {
        type: 'fileScope',
        message: `File outside scope: ${event.path}`,
        agentId: context.agentId,
        event,
        correction: {
          type: 'block',
          message: `Cannot modify ${event.path} - not in task scope`,
        },
      };
    }

    return null;
  }

  updateAllowedFiles(files: string[]): void {
    this.allowedFiles = new Set(files);
  }
}
