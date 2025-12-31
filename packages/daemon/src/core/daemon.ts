// packages/daemon/src/core/daemon.ts
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from '../state/manager.js';
import { TrajectoryLogger } from '../trajectory/logger.js';
import { IPCServer } from '../ipc/server.js';
import { TaskStatus } from '../types/state.js';
import { CheckerChain } from '../checkers/chain.js';
import { CorrectionApplicator, type Correction } from '../corrections/applicator.js';
import type { Violation, TrajectoryEvent } from '../checkers/types.js';

interface DaemonOptions {
  worktreeRoot: string;
  socketPath?: string;
}

export interface ProcessEventResult {
  violation?: Violation;
  correction?: Correction;
}

export interface Agent {
  injectPrompt: (message: string) => void | Promise<void>;
}

export class Daemon {
  private readonly worktreeRoot: string;
  private readonly socketPath: string;
  private readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly ipcServer: IPCServer;
  private running: boolean = false;
  private checkerChain: CheckerChain | null = null;
  private trajectoryHistory: TrajectoryEvent[] = [];
  private readonly agents: Map<string, Agent> = new Map();
  private correctionApplicator: CorrectionApplicator | null = null;

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
        }
        return { violation, correction };
      }
    }

    return {};
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
