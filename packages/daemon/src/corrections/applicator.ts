// packages/daemon/src/corrections/applicator.ts
export interface Correction {
  type: 'prompt' | 'warn' | 'block' | 'restart' | 'reassign' | 'escalate';
  message?: string;
  to?: string;
}

interface ApplicatorDeps {
  injectPrompt: (agentId: string, message: string) => Promise<void>;
  killAgent?: (agentId: string) => Promise<void>;
  reassignTask?: (agentId: string) => Promise<void>;
}

interface ApplyResult {
  blocked: boolean;
  message?: string | undefined;
}

export class CorrectionApplicator {
  private readonly deps: ApplicatorDeps;

  constructor(deps: ApplicatorDeps) {
    this.deps = deps;
  }

  async apply(agentId: string, correction: Correction): Promise<ApplyResult> {
    switch (correction.type) {
      case 'prompt':
        await this.deps.injectPrompt(agentId, `<correction>\n${correction.message}\n</correction>`);
        return { blocked: false };

      case 'warn':
        console.warn(`[${agentId}] Warning: ${correction.message}`);
        return { blocked: false };

      case 'block':
        await this.deps.injectPrompt(agentId, `<blocked>\n${correction.message}\n</blocked>`);
        return { blocked: true, message: correction.message };

      case 'restart':
        if (this.deps.killAgent) {
          await this.deps.killAgent(agentId);
        }
        return { blocked: true, message: 'Agent restarted' };

      case 'reassign':
        if (this.deps.reassignTask) {
          await this.deps.reassignTask(agentId);
        }
        return { blocked: true, message: 'Task reassigned' };

      case 'escalate':
        return { blocked: false, message: `Escalated to ${correction.to}` };

      default:
        return { blocked: false };
    }
  }
}
