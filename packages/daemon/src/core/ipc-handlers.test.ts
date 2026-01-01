// packages/daemon/src/core/ipc-handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerIPCHandlers } from './ipc-handlers.js';
import { TaskStatus } from '../types/state.js';

describe('registerIPCHandlers', () => {
  let mockServer: { registerHandler: ReturnType<typeof vi.fn> };
  let handlers: Record<string, (request?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    handlers = {};
    mockServer = {
      registerHandler: vi.fn((name: string, handler: (request?: unknown) => Promise<unknown>) => {
        handlers[name] = handler;
      }),
    };
  });

  describe('handler registration', () => {
    it('registers all expected handlers', () => {
      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: { tail: vi.fn(), filterByAgent: vi.fn(), log: vi.fn() } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      expect(mockServer.registerHandler).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockServer.registerHandler).toHaveBeenCalledWith('get_state', expect.any(Function));
      expect(mockServer.registerHandler).toHaveBeenCalledWith('get_logs', expect.any(Function));
      expect(mockServer.registerHandler).toHaveBeenCalledWith('heartbeat', expect.any(Function));
      expect(mockServer.registerHandler).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockServer.registerHandler).toHaveBeenCalledWith('shutdown', expect.any(Function));
    });
  });

  describe('ping handler', () => {
    it('returns running status and pid', async () => {
      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: { tail: vi.fn() } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = await handlers['ping']();

      expect(result).toEqual({
        running: true,
        pid: process.pid,
      });
    });
  });

  describe('get_state handler', () => {
    it('returns loaded state', async () => {
      const mockState = {
        workflowId: 'test',
        currentPhase: 'design',
        tasks: {},
        agents: {},
      };
      const mockStateManager = {
        load: vi.fn().mockResolvedValue(mockState),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: mockStateManager as any,
        trajectory: { tail: vi.fn() } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = await handlers['get_state']();

      expect(mockStateManager.load).toHaveBeenCalled();
      expect(result).toEqual({ state: mockState });
    });

    it('returns null state when not loaded', async () => {
      const mockStateManager = {
        load: vi.fn().mockResolvedValue(null),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: mockStateManager as any,
        trajectory: { tail: vi.fn() } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = await handlers['get_state']();

      expect(result).toEqual({ state: null });
    });
  });

  describe('status handler', () => {
    it('returns inactive status when no state', async () => {
      const mockStateManager = {
        load: vi.fn().mockResolvedValue(null),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: mockStateManager as any,
        trajectory: { tail: vi.fn().mockResolvedValue([]) } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = await handlers['status']({});

      expect(result).toEqual({
        active: false,
        summary: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 },
        tasks: {},
        events: [],
        activeWorkers: [],
      });
    });

    it('aggregates task counts by status', async () => {
      const mockState = {
        tasks: {
          task1: { id: 'task1', status: TaskStatus.COMPLETED },
          task2: { id: 'task2', status: TaskStatus.RUNNING, claimedBy: 'agent-1' },
          task3: { id: 'task3', status: TaskStatus.PENDING },
          task4: { id: 'task4', status: TaskStatus.FAILED },
          task5: { id: 'task5', status: TaskStatus.RUNNING, claimedBy: 'agent-2' },
        },
      };
      const mockStateManager = {
        load: vi.fn().mockResolvedValue(mockState),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: mockStateManager as any,
        trajectory: { tail: vi.fn().mockResolvedValue([]) } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = (await handlers['status']({})) as {
        active: boolean;
        summary: { total: number; completed: number; running: number; pending: number; failed: number };
        activeWorkers: string[];
      };

      expect(result.active).toBe(true);
      expect(result.summary).toEqual({
        total: 5,
        completed: 1,
        running: 2,
        pending: 1,
        failed: 1,
      });
      expect(result.activeWorkers).toEqual(['agent-1', 'agent-2']);
    });

    it('respects eventCount parameter', async () => {
      const mockTrajectory = {
        tail: vi.fn().mockResolvedValue([]),
      };
      const mockStateManager = {
        load: vi.fn().mockResolvedValue({ tasks: {} }),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: mockStateManager as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      await handlers['status']({ eventCount: 50 });

      expect(mockTrajectory.tail).toHaveBeenCalledWith(50);
    });
  });

  describe('heartbeat handler', () => {
    it('records heartbeat and logs event', async () => {
      const mockAgentLifecycle = {
        recordHeartbeat: vi.fn(),
        getActiveAgents: vi.fn().mockReturnValue([]),
      };
      const mockTrajectory = {
        tail: vi.fn(),
        log: vi.fn().mockResolvedValue(undefined),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: mockAgentLifecycle,
        stopCallback: vi.fn(),
      });

      const result = (await handlers['heartbeat']({ workerId: 'agent-1' })) as { ok: boolean; timestamp: number };

      expect(mockAgentLifecycle.recordHeartbeat).toHaveBeenCalledWith('agent-1');
      expect(mockTrajectory.log).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat',
          agentId: 'agent-1',
        })
      );
      expect(result.ok).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('get_logs handler', () => {
    it('returns logs from trajectory.tail with default limit', async () => {
      const mockEvents = [
        { type: 'spawn', timestamp: 1000, agentId: 'agent-1' },
        { type: 'tool_use', timestamp: 2000, agentId: 'agent-2' },
      ];
      const mockTrajectory = {
        tail: vi.fn().mockResolvedValue(mockEvents),
        filterByAgent: vi.fn(),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = (await handlers['get_logs']({})) as { logs: Array<{ timestamp: number; agentId: string; type: string; message: string }> };

      expect(mockTrajectory.tail).toHaveBeenCalledWith(20);
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0]).toEqual({
        timestamp: 1000,
        agentId: 'agent-1',
        type: 'spawn',
        message: expect.any(String),
      });
    });

    it('respects custom limit parameter', async () => {
      const mockTrajectory = {
        tail: vi.fn().mockResolvedValue([]),
        filterByAgent: vi.fn(),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      await handlers['get_logs']({ limit: 100 });

      expect(mockTrajectory.tail).toHaveBeenCalledWith(100);
    });

    it('filters by agentId when provided', async () => {
      const mockEvents = [{ type: 'spawn', timestamp: 1000, agentId: 'agent-1' }];
      const mockTrajectory = {
        tail: vi.fn(),
        filterByAgent: vi.fn().mockResolvedValue(mockEvents),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = (await handlers['get_logs']({ agentId: 'agent-1', limit: 50 })) as { logs: Array<unknown> };

      expect(mockTrajectory.filterByAgent).toHaveBeenCalledWith('agent-1', 50);
      expect(mockTrajectory.tail).not.toHaveBeenCalled();
      expect(result.logs).toHaveLength(1);
    });

    it('uses "system" as default agentId when event has none', async () => {
      const mockEvents = [{ type: 'phase_transition', timestamp: 1000 }];
      const mockTrajectory = {
        tail: vi.fn().mockResolvedValue(mockEvents),
        filterByAgent: vi.fn(),
      };

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: mockTrajectory as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback: vi.fn(),
      });

      const result = (await handlers['get_logs']({})) as { logs: Array<{ agentId: string }> };

      expect(result.logs[0].agentId).toBe('system');
    });
  });

  describe('shutdown handler', () => {
    it('schedules shutdown and returns confirmation', async () => {
      vi.useFakeTimers();
      const stopCallback = vi.fn();

      registerIPCHandlers(mockServer as any, {
        stateManager: {} as any,
        trajectory: { tail: vi.fn() } as any,
        agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) },
        stopCallback,
      });

      const result = await handlers['shutdown']();

      expect(result).toEqual({ shutdown: true });
      expect(stopCallback).not.toHaveBeenCalled();

      // Advance timer to trigger shutdown
      await vi.advanceTimersByTimeAsync(100);

      expect(stopCallback).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
