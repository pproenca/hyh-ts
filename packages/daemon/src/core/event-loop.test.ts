// packages/daemon/src/core/event-loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventLoop } from './event-loop.js';

describe('EventLoop', () => {
  it('should call daemon.spawnAgents when spawn triggers fire', async () => {
    const mockDaemon = {
      checkSpawnTriggers: vi.fn().mockResolvedValue([{ agentType: 'worker', taskId: 't1' }]),
      spawnAgents: vi.fn().mockResolvedValue(undefined),
      checkPhaseTransition: vi.fn().mockResolvedValue(false),
      stateManager: { flush: vi.fn() },
      heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
    };

    const eventLoop = new EventLoop(mockDaemon as any, { tickInterval: 10 });

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
});
