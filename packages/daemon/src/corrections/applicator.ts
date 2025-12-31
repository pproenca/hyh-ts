// packages/daemon/src/corrections/applicator.ts
import type { Correction } from '@hyh/dsl';

export type { Correction };

export interface CompactOptions {
  keepLastN?: number | undefined;
  summarize?: boolean | undefined;
}

export interface ApplicatorDeps {
  injectPrompt: (agentId: string, message: string) => Promise<void>;
  killAgent: (agentId: string) => Promise<void>;
  respawnAgent: (agentId: string) => Promise<void>;
  reassignTask: (agentId: string) => Promise<void>;
  compactContext: (agentId: string, options: CompactOptions) => Promise<void>;
}

interface ApplyResult {
  blocked: boolean;
  message?: string | undefined;
}

// Extended correction type with compact-specific options
interface CorrectionWithCompactOptions extends Correction {
  keepLastN?: number;
  summarize?: boolean;
}

export class CorrectionApplicator {
  private readonly deps: ApplicatorDeps;

  constructor(deps: ApplicatorDeps) {
    this.deps = deps;
  }

  async apply(agentId: string, correction: CorrectionWithCompactOptions): Promise<ApplyResult> {
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
        await this.deps.killAgent(agentId);
        await this.deps.respawnAgent(agentId);
        return { blocked: true, message: 'Agent restarted' };

      case 'reassign':
        await this.deps.reassignTask(agentId);
        return { blocked: true, message: 'Task reassigned' };

      case 'escalate':
        return { blocked: false, message: `Escalated to ${correction.to}` };

      case 'retry':
        // Retry correction - signal that operation should be retried
        return { blocked: false, message: `Retry requested (max: ${correction.max ?? 3}, backoff: ${correction.backoff ?? 1000}ms)` };

      case 'compact':
        await this.deps.compactContext(agentId, {
          keepLastN: correction.keepLastN,
          summarize: correction.summarize,
        });
        return { blocked: false, message: 'Context compaction requested' };

      default:
        return { blocked: false };
    }
  }
}
