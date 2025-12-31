// packages/daemon/src/workflow/spawn-trigger.ts
import type { CompiledPhase, CompiledQueue } from '@hyh/dsl';

interface SpawnTriggerConfig {
  phases: Array<Partial<CompiledPhase>>;
  queues: Record<string, Partial<CompiledQueue>>;
}

interface TriggerContext {
  currentPhase: string;
  readyTasks: string[];
  activeAgentCount: number;
}

export interface SpawnSpec {
  agentType: string;
  taskId: string;
}

export class SpawnTriggerManager {
  private readonly phases: Map<string, Partial<CompiledPhase>>;

  constructor(config: SpawnTriggerConfig) {
    this.phases = new Map();
    for (const phase of config.phases) {
      if (phase.name) {
        this.phases.set(phase.name, phase);
      }
    }
  }

  checkTriggers(context: TriggerContext): SpawnSpec[] {
    const phase = this.phases.get(context.currentPhase);
    if (!phase || !phase.queue || !phase.agent) return [];

    const maxParallel = phase.parallel === true
      ? Infinity
      : (typeof phase.parallel === 'number' ? phase.parallel : 1);

    const availableSlots = Math.max(0, maxParallel - context.activeAgentCount);
    const toSpawn = Math.min(context.readyTasks.length, availableSlots);

    return context.readyTasks.slice(0, toSpawn).map(taskId => ({
      agentType: phase.agent!,
      taskId,
    }));
  }
}
