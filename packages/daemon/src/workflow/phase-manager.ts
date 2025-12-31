// packages/daemon/src/workflow/phase-manager.ts
import type { CompiledPhase } from '@hyh/dsl';

interface PhaseManagerConfig {
  phases: Array<Partial<CompiledPhase> & { requires?: string[]; outputs?: string[] }>;
}

interface TransitionContext {
  artifacts: string[];
  queueEmpty?: boolean;
  checkpointPassed?: boolean;
}

export class PhaseManager {
  private readonly phases: Map<string, Partial<CompiledPhase> & { requires?: string[]; outputs?: string[] }>;
  private readonly phaseOrder: string[];

  constructor(config: PhaseManagerConfig) {
    this.phases = new Map();
    this.phaseOrder = [];
    for (const phase of config.phases) {
      if (phase.name) {
        this.phases.set(phase.name, phase);
        this.phaseOrder.push(phase.name);
      }
    }
  }

  canTransition(from: string, to: string, context: TransitionContext): boolean {
    const toPhase = this.phases.get(to);
    if (!toPhase) return false;

    // Check requires artifacts exist
    const requires = toPhase.requires || [];
    for (const req of requires) {
      if (!context.artifacts.includes(req)) {
        return false;
      }
    }

    return true;
  }

  getNextPhase(current: string): string | null {
    const idx = this.phaseOrder.indexOf(current);
    if (idx === -1 || idx >= this.phaseOrder.length - 1) return null;
    return this.phaseOrder[idx + 1] ?? null;
  }
}
