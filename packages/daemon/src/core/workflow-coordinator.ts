// packages/daemon/src/core/workflow-coordinator.ts
import * as fs from 'node:fs/promises';
import type { CompiledWorkflow, CompiledGate } from '@hyh/dsl';
import type { StateManager } from '../state/manager.js';
import type { TrajectoryLogger, TrajectoryEvent } from '../trajectory/logger.js';
import { PhaseManager } from '../workflow/phase-manager.js';
import { SpawnTriggerManager, type SpawnSpec } from '../workflow/spawn-trigger.js';
import { GateExecutor, type GateResult, type GateConfig } from '../workflow/gate-executor.js';

export interface WorkflowCoordinatorConfig {
  stateManager: StateManager;
  trajectory: TrajectoryLogger;
  cwd?: string;
}

export class WorkflowCoordinator {
  private readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly cwd: string;

  private workflow: CompiledWorkflow | null = null;
  private phaseManager: PhaseManager | null = null;
  private spawnTriggerManager: SpawnTriggerManager | null = null;
  private gateExecutor: GateExecutor | null = null;

  constructor(config: WorkflowCoordinatorConfig) {
    this.stateManager = config.stateManager;
    this.trajectory = config.trajectory;
    this.cwd = config.cwd ?? process.cwd();
  }

  /**
   * Load workflow from JSON file and initialize managers
   */
  async load(path: string): Promise<void> {
    const content = await fs.readFile(path, 'utf-8');
    this.workflow = JSON.parse(content) as CompiledWorkflow;

    // Initialize managers
    this.phaseManager = new PhaseManager({
      phases: this.workflow.phases,
    });

    this.spawnTriggerManager = new SpawnTriggerManager({
      phases: this.workflow.phases,
      queues: this.workflow.queues,
    });

    this.gateExecutor = new GateExecutor();
  }

  /**
   * Get the loaded workflow
   */
  getWorkflow(): CompiledWorkflow | null {
    return this.workflow;
  }

  /**
   * Get current phase from state
   */
  async getCurrentPhase(): Promise<string | null> {
    const state = await this.stateManager.load();
    return state?.currentPhase ?? null;
  }

  /**
   * Check if phase should transition based on current state
   */
  async checkPhaseTransition(): Promise<boolean> {
    if (!this.workflow || !this.phaseManager) {
      return false;
    }

    const state = await this.stateManager.load();
    if (!state) {
      return false;
    }

    const currentPhase = state.currentPhase;
    const nextPhase = this.phaseManager.getNextPhase(currentPhase);

    if (!nextPhase) {
      return false;
    }

    // Build artifacts list from completed task outputs
    const artifacts: string[] = [];
    for (const task of Object.values(state.tasks)) {
      if (task.status === 'completed' && task.files) {
        artifacts.push(...task.files);
      }
    }

    // Check if all tasks in current phase are done (queue empty)
    const currentPhaseConfig = this.workflow.phases.find((p) => p.name === currentPhase);
    let queueEmpty = true;
    if (currentPhaseConfig?.queue) {
      const phaseTasks = Object.values(state.tasks).filter(
        (t) => t.status !== 'completed' && t.status !== 'failed'
      );
      queueEmpty = phaseTasks.length === 0;
    }

    return this.phaseManager.canTransition(currentPhase, nextPhase, {
      artifacts,
      queueEmpty,
    });
  }

  /**
   * Check spawn triggers and return specs for agents to spawn
   */
  async checkSpawnTriggers(): Promise<SpawnSpec[]> {
    if (!this.workflow || !this.spawnTriggerManager) {
      return [];
    }

    const state = await this.stateManager.load();
    if (!state) {
      return [];
    }

    // Find ready tasks (pending with satisfied dependencies)
    const readyTasks: string[] = [];
    for (const [taskId, task] of Object.entries(state.tasks)) {
      if (task.status === 'pending') {
        const depsOk = task.dependencies.every((depId) => {
          const dep = state.tasks[depId];
          return dep?.status === 'completed';
        });
        if (depsOk) {
          readyTasks.push(taskId);
        }
      }
    }

    // Count active agents
    const activeAgentCount = Object.values(state.agents).filter(
      (a) => a.status === 'active'
    ).length;

    return this.spawnTriggerManager.checkTriggers({
      currentPhase: state.currentPhase,
      readyTasks,
      activeAgentCount,
    });
  }

  /**
   * Execute a gate by name
   */
  async executeGate(gateName: string, cwd?: string): Promise<GateResult | null> {
    if (!this.workflow || !this.gateExecutor) {
      return null;
    }

    const gate = this.workflow.gates[gateName];
    if (!gate) {
      return null;
    }

    // Convert CompiledGate to GateConfig
    const gateConfig: GateConfig = {
      name: gate.name,
      checks: gate.requires.map((cmd) => ({
        type: 'command' as const,
        command: cmd,
      })),
    };

    return this.gateExecutor.execute(gateConfig, cwd ?? this.cwd);
  }

  /**
   * Transition to a new phase
   */
  async transitionTo(phaseName: string): Promise<void> {
    const state = await this.stateManager.load();
    const fromPhase = state?.currentPhase ?? '';

    await this.stateManager.update((s) => {
      const transition = {
        from: s.currentPhase,
        to: phaseName,
        timestamp: Date.now(),
      };
      s.currentPhase = phaseName;
      s.phaseHistory.push(transition);
    });

    await this.trajectory.log({
      type: 'phase_transition',
      timestamp: Date.now(),
      from: fromPhase,
      to: phaseName,
    } as TrajectoryEvent);
  }
}
