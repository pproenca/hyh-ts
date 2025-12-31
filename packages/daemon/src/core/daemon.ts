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
import { AgentManager } from '../agents/manager.js';
import { WorktreeManager } from '../git/worktree.js';
import { PhaseManager } from '../workflow/phase-manager.js';
import { HeartbeatMonitor, type HeartbeatStatus } from '../agents/heartbeat.js';
import { GateExecutor, type GateResult } from '../workflow/gate-executor.js';
import { ArtifactManager, type Artifact } from '../managers/artifact.js';
import type { CompiledWorkflow } from '@hyh/dsl';

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
  /** Public for testing and integration scenarios that need direct state access */
  readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly ipcServer: IPCServer;
  private readonly artifactManager: ArtifactManager;
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
  private readonly agentManager: AgentManager;
  private readonly worktreeManager: WorktreeManager;

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
    this.artifactManager = new ArtifactManager(
      path.join(this.worktreeRoot, '.hyh', 'artifacts')
    );
    this.agentManager = new AgentManager(this.worktreeRoot);
    this.worktreeManager = new WorktreeManager(this.worktreeRoot);

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

  getAgentManager(): AgentManager {
    return this.agentManager;
  }

  getActiveAgents(): { agentId: string; pollEvents: () => TrajectoryEvent[] }[] {
    const agents = this.agentManager.getActiveAgents();
    return agents.map(agent => ({
      agentId: agent.agentId,
      pollEvents: () => {
        // Poll events from the agent's event emitter
        const events: TrajectoryEvent[] = [];
        // For now return empty - actual implementation would buffer events
        return events;
      },
    }));
  }

  async spawnAgents(specs: SpawnSpec[]): Promise<void> {
    // Load state to get task dependencies for wave calculation
    const state = await this.stateManager.load();
    const taskMap: Record<string, { id: string; dependencies: string[] }> = {};

    if (state) {
      for (const [id, task] of Object.entries(state.tasks)) {
        taskMap[id] = { id, dependencies: task.dependencies };
      }
    }

    for (const spec of specs) {
      // Get agent config from workflow
      const agentConfig = this.workflow?.agents?.[spec.agentType];
      if (!agentConfig) {
        continue;
      }

      // Convert ToolSpec[] to string[] (extract tool name from ToolSpec)
      const toolNames = (agentConfig.tools || []).map((tool) =>
        typeof tool === 'string' ? tool : tool.tool
      );

      // Calculate wave for the task to determine worktree path
      let worktreePath: string | undefined;
      const task = spec.taskId ? taskMap[spec.taskId] : undefined;
      if (task) {
        const wave = this.worktreeManager.calculateWave(task, taskMap);
        worktreePath = this.worktreeManager.getWorktreePath(wave);
      }

      // Build full spawn spec with agent configuration
      const fullSpec = {
        agentType: spec.agentType,
        taskId: spec.taskId,
        model: (agentConfig.model || 'sonnet') as 'haiku' | 'sonnet' | 'opus',
        tools: toolNames,
        systemPromptPath: agentConfig.systemPrompt || '',
        ...(worktreePath && { worktreePath }),
      };

      const process = await this.agentManager.spawn(fullSpec);

      // Log spawn
      await this.trajectory.log({
        type: 'spawn',
        timestamp: Date.now(),
        agentId: process.agentId,
      });
    }
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

  checkHeartbeats(): string[] {
    const overdueAgents = this.heartbeatMonitor.getOverdueAgents();
    return overdueAgents.map((a) => a.agentId);
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
      killAgent: async (id: string) => {
        // Kill agent process - to be implemented with AgentManager integration
        this.agents.delete(id);
      },
      respawnAgent: async (id: string) => {
        // Respawn agent - to be implemented with AgentManager integration
        // For now, this is a placeholder that will be wired up later
      },
      reassignTask: async (id: string) => {
        // Reassign task from agent - to be implemented with StateManager integration
        // For now, this is a placeholder that will be wired up later
      },
      compactContext: async (id: string, options) => {
        // Compact agent context - to be implemented with context management
        // For now, this is a placeholder that will be wired up later
      },
    });
  }

  async completeTask(
    taskId: string,
    workerId: string,
    artifact?: Partial<Artifact>
  ): Promise<void> {
    await this.stateManager.completeTask(taskId, workerId);

    if (artifact) {
      await this.artifactManager.save({
        taskId,
        status: 'complete',
        summary: artifact.summary || '',
        files: artifact.files || { created: [], modified: [] },
        exports: artifact.exports || [],
        tests: artifact.tests || { passed: 0, failed: 0, command: '' },
        notes: artifact.notes || '',
      });
    }

    await this.trajectory.log({
      type: 'task_complete',
      timestamp: Date.now(),
      agentId: workerId,
      taskId,
    });
  }

  async getArtifact(taskId: string): Promise<Artifact | null> {
    return this.artifactManager.load(taskId);
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

    // 2. Check spawn triggers AND ACTUALLY SPAWN
    const spawns = await this.checkSpawnTriggers();
    if (spawns.length > 0) {
      await this.spawnAgents(spawns);
      result.spawnsTriggered = spawns.length;
    }

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

    // Get logs
    this.ipcServer.registerHandler('get_logs', async (request: unknown) => {
      const req = request as { limit?: number; agentId?: string };
      const limit = req.limit ?? 20;

      const events = req.agentId
        ? await this.trajectory.filterByAgent(req.agentId, limit)
        : await this.trajectory.tail(limit);

      return {
        logs: events.map((e) => ({
          timestamp: e.timestamp,
          agentId: e.agentId ?? 'system',
          type: e.type,
          message: JSON.stringify(e),
        })),
      };
    });
  }
}
