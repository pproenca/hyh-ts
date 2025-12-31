// packages/daemon/src/core/daemon.ts
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from '../state/manager.js';
import { TrajectoryLogger } from '../trajectory/logger.js';
import { IPCServer } from '../ipc/server.js';
import { CheckerChain } from '../checkers/chain.js';
import { CorrectionApplicator, type Correction } from '../corrections/applicator.js';
import type { Violation, TrajectoryEvent } from '../checkers/types.js';
import type { SpawnSpec } from '../workflow/spawn-trigger.js';
import { AgentManager } from '../agents/manager.js';
import { WorktreeManager } from '../git/worktree.js';
import { HeartbeatMonitor, type HeartbeatStatus } from '../agents/heartbeat.js';
import type { GateResult } from '../workflow/gate-executor.js';
import { ArtifactManager, type Artifact } from '../managers/artifact.js';
import { EventProcessor } from './event-processor.js';
import { AgentLifecycle } from './agent-lifecycle.js';
import { WorkflowCoordinator } from './workflow-coordinator.js';
import { registerIPCHandlers } from './ipc-handlers.js';

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
  private readonly agents: Map<string, Agent> = new Map();
  private correctionApplicator: CorrectionApplicator | null = null;
  private readonly heartbeatMonitor: HeartbeatMonitor = new HeartbeatMonitor();
  private readonly agentManager: AgentManager;
  private readonly worktreeManager: WorktreeManager;

  // Extracted services
  private eventProcessor: EventProcessor | null = null;
  private readonly agentLifecycle: AgentLifecycle;
  private readonly workflowCoordinator: WorkflowCoordinator;

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

    // Initialize extracted services
    this.agentLifecycle = new AgentLifecycle({
      agentManager: this.agentManager,
      stateManager: this.stateManager,
      trajectory: this.trajectory,
      heartbeatMonitor: this.heartbeatMonitor,
    });

    this.workflowCoordinator = new WorkflowCoordinator({
      stateManager: this.stateManager,
      trajectory: this.trajectory,
      cwd: this.worktreeRoot,
    });

    // EventProcessor is initialized when checkerChain is loaded (needs correctionApplicator)
    this.eventProcessor = new EventProcessor({
      trajectory: this.trajectory,
      stateManager: this.stateManager,
      checkerChain: null,
      correctionApplicator: null,
    });

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

    // Get workflow from coordinator
    const workflow = this.workflowCoordinator.getWorkflow();

    for (const spec of specs) {
      // Get agent config from workflow
      const agentConfig = workflow?.agents?.[spec.agentType];
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
    // Reinitialize EventProcessor with the checker chain
    this.eventProcessor = new EventProcessor({
      trajectory: this.trajectory,
      stateManager: this.stateManager,
      checkerChain: this.checkerChain,
      correctionApplicator: this.correctionApplicator,
    });
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
      respawnAgent: async (_id: string) => {
        // Respawn agent - to be implemented with AgentManager integration
        // For now, this is a placeholder that will be wired up later
      },
      reassignTask: async (_id: string) => {
        // Reassign task from agent - to be implemented with StateManager integration
        // For now, this is a placeholder that will be wired up later
      },
      compactContext: async (_id: string, _options) => {
        // Compact agent context - to be implemented with context management
        // For now, this is a placeholder that will be wired up later
      },
    });

    // Reinitialize EventProcessor with the updated correction applicator
    this.eventProcessor = new EventProcessor({
      trajectory: this.trajectory,
      stateManager: this.stateManager,
      checkerChain: this.checkerChain,
      correctionApplicator: this.correctionApplicator,
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
    // Delegate to EventProcessor
    if (this.eventProcessor) {
      return this.eventProcessor.process(agentId, event);
    }
    return {};
  }

  async loadWorkflow(workflowPath: string): Promise<void> {
    // Load via WorkflowCoordinator (handles managers initialization)
    await this.workflowCoordinator.load(workflowPath);

    // Also keep local reference for spawnAgents which needs workflow config
    const workflow = this.workflowCoordinator.getWorkflow();

    // Initialize state with first phase if not already set
    const state = await this.stateManager.load();
    const firstPhase = workflow?.phases[0];
    if (!state && firstPhase && workflow) {
      const workflowName = workflow.name;
      const phaseName = firstPhase.name;
      await this.stateManager.update((s) => {
        s.workflowId = workflowName;
        s.workflowName = workflowName;
        s.currentPhase = phaseName;
      });
    }
  }

  async executeGate(gateName: string): Promise<GateResult> {
    const result = await this.workflowCoordinator.executeGate(gateName, this.worktreeRoot);
    if (!result) {
      return { passed: false, error: 'No workflow loaded or gate not found' };
    }
    return result;
  }

  async checkSpawnTriggers(): Promise<SpawnSpec[]> {
    return this.workflowCoordinator.checkSpawnTriggers();
  }

  async checkPhaseTransition(): Promise<boolean> {
    return this.workflowCoordinator.checkPhaseTransition();
  }

  async transitionPhase(targetPhase: string): Promise<void> {
    await this.workflowCoordinator.transitionTo(targetPhase);
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
      if (state) {
        const nextPhase = this.workflowCoordinator.getNextPhase(state.currentPhase);
        if (nextPhase) {
          await this.transitionPhase(nextPhase);
          result.phaseTransitioned = true;
        }
      }
    }

    return result;
  }

  private registerHandlers(): void {
    // Register common handlers via extracted service
    registerIPCHandlers(this.ipcServer, {
      stateManager: this.stateManager,
      trajectory: this.trajectory,
      agentLifecycle: {
        recordHeartbeat: (agentId: string) => this.agentLifecycle.recordHeartbeat(agentId),
        getActiveAgents: () => this.getActiveAgents(),
      },
      stopCallback: () => this.stop(),
    });

    // Task claim (not in ipc-handlers.ts)
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

    // Task complete (not in ipc-handlers.ts)
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

    // Plan reset (not in ipc-handlers.ts)
    this.ipcServer.registerHandler('plan_reset', async () => {
      await this.stateManager.reset();

      await this.trajectory.log({
        type: 'plan_reset',
        timestamp: Date.now(),
      });

      return { message: 'Workflow state cleared' };
    });
  }
}
