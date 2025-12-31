// packages/daemon/src/core/daemon.ts
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from '../state/manager.js';
import { TrajectoryLogger } from '../trajectory/logger.js';
import { IPCServer } from '../ipc/server.js';
import { TaskStatus } from '../types/state.js';
import { CheckerChain } from '../checkers/chain.js';
import { CorrectionApplicator, type Correction } from '../corrections/applicator.js';
import type { Violation, TrajectoryEvent } from '../checkers/types.js';
import { SpawnTriggerManager, type SpawnSpec } from '../workflow/spawn-trigger.js';
import { PhaseManager } from '../workflow/phase-manager.js';
import { HeartbeatMonitor, type HeartbeatStatus } from '../agents/heartbeat.js';
import { GateExecutor, type GateResult } from '../workflow/gate-executor.js';
import type { CompiledWorkflow, CompiledPhase, CompiledQueue } from '@hyh/dsl';

interface DaemonOptions {
  worktreeRoot: string;
  socketPath?: string;
}

export interface ProcessEventResult {
  violation?: Violation;
  correction?: Correction;
}

export interface TickResult {
  spawnsTriggered: number;
  heartbeatsMissed: string[];
  phaseTransitioned: boolean;
  correctionsApplied: number;
}

export interface Agent {
  injectPrompt: (message: string) => void | Promise<void>;
}

export class Daemon {
  private readonly worktreeRoot: string;
  private readonly socketPath: string;
  readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly ipcServer: IPCServer;
  private running: boolean = false;
  private checkerChain: CheckerChain | null = null;
  private trajectoryHistory: TrajectoryEvent[] = [];
  private readonly agents: Map<string, Agent> = new Map();
  private correctionApplicator: CorrectionApplicator | null = null;
  private workflow: CompiledWorkflow | null = null;
  private spawnTriggerManager: SpawnTriggerManager | null = null;
  private phaseManager: PhaseManager | null = null;
  private readonly heartbeatMonitor: HeartbeatMonitor = new HeartbeatMonitor();
  private gateExecutor: GateExecutor | null = null;

  constructor(options: DaemonOptions) {
    this.worktreeRoot = options.worktreeRoot;

    // Generate socket path based on worktree hash
    const hash = crypto.createHash('sha256').update(this.worktreeRoot).digest('hex').slice(0, 16);
    this.socketPath =
      options.socketPath ?? path.join(os.homedir(), '.hyh', 'sockets', `${hash}.sock`);

    // Initialize components
    this.stateManager = new StateManager(this.worktreeRoot);
    this.trajectory = new TrajectoryLogger(path.join(this.worktreeRoot, '.hyh', 'trajectory.jsonl'));
    this.ipcServer = new IPCServer(this.socketPath);

    // Register handlers
    this.registerHandlers();
  }

  async start(): Promise<void> {
    await this.ipcServer.start();
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.ipcServer.stop();
  }

  getSocketPath(): string {
    return this.socketPath;
  }

  loadCheckerChain(checkerChain: CheckerChain): void {
    this.checkerChain = checkerChain;
  }

  recordHeartbeat(agentId: string): void {
    this.heartbeatMonitor.recordHeartbeat(agentId);
  }

  checkHeartbeat(agentId: string, interval: number): HeartbeatStatus {
    return this.heartbeatMonitor.check(agentId, interval);
  }

  setAgent(agentId: string, agent: Agent): void {
    this.agents.set(agentId, agent);
    // Create/update CorrectionApplicator with current agents
    this.correctionApplicator = new CorrectionApplicator({
      injectPrompt: async (id: string, message: string) => {
        const targetAgent = this.agents.get(id);
        if (targetAgent) {
          await targetAgent.injectPrompt(message);
        }
      },
    });
  }

  async processAgentEvent(
    agentId: string,
    event: TrajectoryEvent
  ): Promise<ProcessEventResult> {
    // 1. Log event to trajectory
    await this.trajectory.log(event);
    this.trajectoryHistory.push(event);

    // 2. Check invariants via CheckerChain
    if (this.checkerChain) {
      const state = await this.stateManager.load();
      const violation = this.checkerChain.check(
        agentId,
        event,
        state,
        this.trajectoryHistory
      );

      // 3. If violation, apply correction if available
      if (violation) {
        const correction = violation.correction;
        if (correction && this.correctionApplicator) {
          await this.correctionApplicator.apply(agentId, correction);
          return { violation, correction };
        }
        return { violation };
      }
    }

    return {};
  }

  async loadWorkflow(workflowPath: string): Promise<void> {
    const content = await fs.readFile(workflowPath, 'utf-8');
    this.workflow = JSON.parse(content) as CompiledWorkflow;

    // Initialize SpawnTriggerManager
    this.spawnTriggerManager = new SpawnTriggerManager({
      phases: this.workflow.phases,
      queues: this.workflow.queues,
    });

    // Initialize PhaseManager
    this.phaseManager = new PhaseManager({
      phases: this.workflow.phases,
    });

    // Initialize GateExecutor
    this.gateExecutor = new GateExecutor();

    // Initialize state with first phase if not already set
    const state = await this.stateManager.load();
    const firstPhase = this.workflow.phases[0];
    if (!state && firstPhase) {
      const workflowName = this.workflow.name;
      const phaseName = firstPhase.name;
      await this.stateManager.update((s) => {
        s.workflowId = workflowName;
        s.workflowName = workflowName;
        s.currentPhase = phaseName;
      });
    }
  }

  async executeGate(gateName: string): Promise<GateResult> {
    if (!this.gateExecutor || !this.workflow) {
      return { passed: false, error: 'No workflow loaded' };
    }

    const gate = this.workflow.gates[gateName];
    if (!gate) {
      return { passed: false, error: `Gate ${gateName} not found` };
    }

    // Convert CompiledGate (requires: string[]) to GateConfig (checks: GateCheck[])
    const gateConfig = {
      name: gate.name,
      checks: gate.requires.map((cmd) => ({
        type: 'command' as const,
        command: cmd,
      })),
    };

    return this.gateExecutor.execute(gateConfig, this.worktreeRoot);
  }

  async checkSpawnTriggers(): Promise<SpawnSpec[]> {
    if (!this.spawnTriggerManager) return [];

    const state = await this.stateManager.load();
    if (!state) return [];

    // Find ready (pending) tasks
    const readyTasks = Object.values(state.tasks)
      .filter((t) => t.status === TaskStatus.PENDING)
      .map((t) => t.id);

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

  async checkPhaseTransition(): Promise<boolean> {
    if (!this.phaseManager) return false;

    const state = await this.stateManager.load();
    if (!state) return false;

    const nextPhase = this.phaseManager.getNextPhase(state.currentPhase);
    if (!nextPhase) return false;

    // Check if we can transition to next phase
    // For now, we check if the queue for current phase is empty (all tasks completed)
    const currentPhase = this.workflow?.phases.find((p) => p.name === state.currentPhase);
    if (currentPhase?.queue) {
      // Check if all tasks are completed
      const allCompleted = Object.values(state.tasks).every(
        (t) => t.status === TaskStatus.COMPLETED
      );
      if (!allCompleted) return false;
    }

    // Gather artifacts (completed task outputs would be artifacts)
    const artifacts: string[] = [];

    return this.phaseManager.canTransition(state.currentPhase, nextPhase, {
      artifacts,
      queueEmpty: true,
    });
  }

  async transitionPhase(targetPhase: string): Promise<void> {
    const state = await this.stateManager.load();
    if (!state) {
      throw new Error('No workflow state');
    }

    const fromPhase = state.currentPhase;

    await this.stateManager.update((s) => {
      s.currentPhase = targetPhase;
      s.phaseHistory.push({
        from: fromPhase,
        to: targetPhase,
        timestamp: Date.now(),
      });
    });

    // Log phase transition to trajectory
    await this.trajectory.log({
      type: 'phase_transition',
      timestamp: Date.now(),
      from: fromPhase,
      to: targetPhase,
    });
  }

  async tick(): Promise<TickResult> {
    const result: TickResult = {
      spawnsTriggered: 0,
      heartbeatsMissed: [],
      phaseTransitioned: false,
      correctionsApplied: 0,
    };

    // 1. Check heartbeats for all registered agents
    const overdueAgents = this.heartbeatMonitor.getOverdueAgents();
    result.heartbeatsMissed = overdueAgents.map((a) => a.agentId);

    // 2. Check spawn triggers
    const spawns = await this.checkSpawnTriggers();
    result.spawnsTriggered = spawns.length;

    // 3. Check phase transitions
    if (await this.checkPhaseTransition()) {
      const state = await this.stateManager.load();
      if (state && this.phaseManager) {
        const nextPhase = this.phaseManager.getNextPhase(state.currentPhase);
        if (nextPhase) {
          await this.transitionPhase(nextPhase);
          result.phaseTransitioned = true;
        }
      }
    }

    return result;
  }

  private registerHandlers(): void {
    // Ping
    this.ipcServer.registerHandler('ping', async () => ({
      running: true,
      pid: process.pid,
    }));

    // Get state
    this.ipcServer.registerHandler('get_state', async () => {
      const state = await this.stateManager.load();
      return { state };
    });

    // Status
    this.ipcServer.registerHandler('status', async (request: unknown) => {
      const req = request as { eventCount?: number };
      const state = await this.stateManager.load();
      const eventCount = req.eventCount ?? 10;

      if (!state) {
        return {
          active: false,
          summary: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 },
          tasks: {},
          events: [],
          activeWorkers: [],
        };
      }

      const tasks = state.tasks;
      let completed = 0,
        running = 0,
        pending = 0,
        failed = 0;
      const activeWorkers: string[] = [];

      for (const task of Object.values(tasks)) {
        switch (task.status) {
          case TaskStatus.COMPLETED:
            completed++;
            break;
          case TaskStatus.RUNNING:
            running++;
            if (task.claimedBy) activeWorkers.push(task.claimedBy);
            break;
          case TaskStatus.PENDING:
            pending++;
            break;
          case TaskStatus.FAILED:
            failed++;
            break;
        }
      }

      const events = await this.trajectory.tail(eventCount);

      return {
        active: true,
        summary: {
          total: Object.keys(tasks).length,
          completed,
          running,
          pending,
          failed,
        },
        tasks,
        events,
        activeWorkers,
      };
    });

    // Task claim
    this.ipcServer.registerHandler('task_claim', async (request: unknown) => {
      const req = request as { workerId: string };
      const result = await this.stateManager.claimTask(req.workerId);

      if (result.task) {
        await this.trajectory.log({
          type: 'task_claim',
          timestamp: Date.now(),
          agentId: req.workerId,
          taskId: result.task.id,
          isRetry: result.isRetry,
          isReclaim: result.isReclaim,
        });
      }

      return {
        task: result.task,
        isRetry: result.isRetry,
        isReclaim: result.isReclaim,
      };
    });

    // Task complete
    this.ipcServer.registerHandler('task_complete', async (request: unknown) => {
      const req = request as { taskId: string; workerId: string; force?: boolean };
      await this.stateManager.completeTask(req.taskId, req.workerId, req.force);

      await this.trajectory.log({
        type: 'task_complete',
        timestamp: Date.now(),
        agentId: req.workerId,
        taskId: req.taskId,
      });

      return { taskId: req.taskId };
    });

    // Plan reset
    this.ipcServer.registerHandler('plan_reset', async () => {
      await this.stateManager.reset();

      await this.trajectory.log({
        type: 'plan_reset',
        timestamp: Date.now(),
      });

      return { message: 'Workflow state cleared' };
    });

    // Heartbeat
    this.ipcServer.registerHandler('heartbeat', async (request: unknown) => {
      const req = request as { workerId: string };

      // Record heartbeat in trajectory
      await this.trajectory.log({
        type: 'heartbeat',
        timestamp: Date.now(),
        agentId: req.workerId,
      });

      return { ok: true, timestamp: Date.now() };
    });

    // Shutdown
    this.ipcServer.registerHandler('shutdown', async () => {
      // Schedule shutdown
      setTimeout(() => this.stop(), 100);
      return { shutdown: true };
    });
  }
}
