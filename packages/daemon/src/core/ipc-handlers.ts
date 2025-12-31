// packages/daemon/src/core/ipc-handlers.ts
import type { IPCServer } from '../ipc/server.js';
import type { StateManager } from '../state/manager.js';
import type { TrajectoryLogger, TrajectoryEvent } from '../trajectory/logger.js';
import { TaskStatus } from '../types/state.js';

export interface AgentLifecycle {
  recordHeartbeat(agentId: string): void;
  getActiveAgents(): Array<{ agentId: string; pollEvents: () => TrajectoryEvent[] }>;
}

export interface IPCHandlerDeps {
  stateManager: StateManager;
  trajectory: TrajectoryLogger;
  agentLifecycle: AgentLifecycle;
  stopCallback: () => void | Promise<void>;
}

export function registerIPCHandlers(server: IPCServer, deps: IPCHandlerDeps): void {
  const { stateManager, trajectory, agentLifecycle, stopCallback } = deps;

  // Ping
  server.registerHandler('ping', async () => ({
    running: true,
    pid: process.pid,
  }));

  // Get state
  server.registerHandler('get_state', async () => {
    const state = await stateManager.load();
    return { state };
  });

  // Status
  server.registerHandler('status', async (request: unknown) => {
    const req = request as { eventCount?: number };
    const state = await stateManager.load();
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

    const events = await trajectory.tail(eventCount);

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

  // Heartbeat
  server.registerHandler('heartbeat', async (request: unknown) => {
    const req = request as { workerId: string };

    agentLifecycle.recordHeartbeat(req.workerId);

    // Record heartbeat in trajectory
    await trajectory.log({
      type: 'heartbeat',
      timestamp: Date.now(),
      agentId: req.workerId,
    });

    return { ok: true, timestamp: Date.now() };
  });

  // Get logs
  server.registerHandler('get_logs', async (request: unknown) => {
    const req = request as { limit?: number; agentId?: string };
    const limit = req.limit ?? 20;

    const events = req.agentId
      ? await trajectory.filterByAgent(req.agentId, limit)
      : await trajectory.tail(limit);

    return {
      logs: events.map((e) => ({
        timestamp: e.timestamp,
        agentId: e.agentId ?? 'system',
        type: e.type,
        message: JSON.stringify(e),
      })),
    };
  });

  // Shutdown
  server.registerHandler('shutdown', async () => {
    // Schedule shutdown
    setTimeout(() => stopCallback(), 100);
    return { shutdown: true };
  });
}
