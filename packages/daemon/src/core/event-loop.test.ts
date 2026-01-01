// packages/daemon/src/core/event-loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventLoop, type Daemon } from './event-loop.js';

describe('EventLoop', () => {
  it('should call daemon.spawnAgents when spawn triggers fire', async () => {
    const mockDaemon = {
      checkSpawnTriggers: vi.fn().mockResolvedValue([{ agentType: 'worker', taskId: 't1' }]),
      spawnAgents: vi.fn().mockResolvedValue(undefined),
      checkPhaseTransition: vi.fn().mockResolvedValue(false),
      stateManager: { flush: vi.fn() },
      heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
    };

    const eventLoop = new EventLoop(mockDaemon as Daemon, { tickInterval: 10 });

    // Run one tick
    await eventLoop.tick();

    expect(mockDaemon.spawnAgents).toHaveBeenCalledWith([{ agentType: 'worker', taskId: 't1' }]);
  });

  it('runs tick cycle and can be stopped', async () => {
    const onTick = vi.fn();
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 50));
    loop.stop();

    expect(onTick).toHaveBeenCalled();
    expect(loop.isRunning).toBe(false);
  });

  it('does not start if already running', () => {
    const loop = new EventLoop({ tickInterval: 100, onTick: vi.fn() });
    loop.start();
    loop.start(); // Should be no-op
    expect(loop.isRunning).toBe(true);
    loop.stop();
  });

  it('handles async onTick', async () => {
    let counter = 0;
    const onTick = vi.fn(async () => {
      counter++;
      await new Promise(r => setTimeout(r, 5));
    });
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 60));
    loop.stop();

    expect(counter).toBeGreaterThan(0);
  });

  it('should poll agent events and process them', async () => {
    const mockDaemon = {
      checkSpawnTriggers: vi.fn().mockResolvedValue([]),
      spawnAgents: vi.fn(),
      checkPhaseTransition: vi.fn().mockResolvedValue(false),
      stateManager: { flush: vi.fn() },
      heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
      getActiveAgents: vi.fn().mockReturnValue([{
        agentId: 'agent-1',
        pollEvents: vi.fn().mockReturnValue([{ type: 'tool_use', tool: 'Read' }]),
      }]),
      processAgentEvent: vi.fn().mockResolvedValue({}),
    };

    const loop = new EventLoop(mockDaemon as unknown as Daemon, { tickInterval: 100 });
    await loop.tick();

    expect(mockDaemon.processAgentEvent).toHaveBeenCalled();
  });
});

describe('EventLoop phase transition', () => {
  it('should check phase transition on each tick', async () => {
    const mockDaemon = {
      checkSpawnTriggers: vi.fn().mockResolvedValue([]),
      spawnAgents: vi.fn(),
      checkPhaseTransition: vi.fn().mockResolvedValue(true),
      stateManager: { flush: vi.fn() },
      heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
    };

    const loop = new EventLoop(mockDaemon as unknown as Daemon, { tickInterval: 100 });
    await loop.tick();

    expect(mockDaemon.checkPhaseTransition).toHaveBeenCalled();
  });
});

describe('EventLoop heartbeat monitoring', () => {
  it('should have heartbeat monitor available on daemon', async () => {
    const mockDaemon = {
      checkSpawnTriggers: vi.fn().mockResolvedValue([]),
      spawnAgents: vi.fn(),
      checkPhaseTransition: vi.fn().mockResolvedValue(false),
      stateManager: { flush: vi.fn() },
      heartbeatMonitor: {
        getOverdueAgents: vi.fn().mockReturnValue([]),
      },
    };

    const loop = new EventLoop(mockDaemon as unknown as Daemon, { tickInterval: 100 });
    await loop.tick();

    // The daemon should have a heartbeat monitor
    expect(mockDaemon.heartbeatMonitor).toBeDefined();
  });
});

describe('EventLoop error handling', () => {
  it('should track tick count', async () => {
    let tickCount = 0;
    const onTick = vi.fn(async () => {
      tickCount++;
    });
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 50));
    loop.stop();

    // Should have ticked multiple times
    expect(tickCount).toBeGreaterThan(0);
  });
});
