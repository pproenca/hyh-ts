// packages/daemon/src/agents/heartbeat.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatMonitor } from './heartbeat.js';

describe('HeartbeatMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks heartbeats and detects misses', () => {
    const monitor = new HeartbeatMonitor();

    monitor.register('agent-1', 30000); // 30s interval
    monitor.recordHeartbeat('agent-1');

    expect(monitor.check('agent-1').status).toBe('ok');

    // Advance time past interval
    vi.advanceTimersByTime(35000);

    const result = monitor.check('agent-1');
    expect(result.status).toBe('miss');
    expect(result.count).toBe(1);
  });
});

describe('HeartbeatMonitor registration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers agent with interval', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 60000);
    expect(monitor.check('agent-1').status).toBe('ok');
  });

  it('unregisters agent', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 30000);
    monitor.unregister('agent-1');
    // After unregister, check returns ok for unknown agent
    expect(monitor.check('agent-1').status).toBe('ok');
  });

  it('auto-registers on heartbeat if not registered', () => {
    const monitor = new HeartbeatMonitor();
    // Record heartbeat without prior registration
    monitor.recordHeartbeat('new-agent');
    // Check with explicit interval since auto-register uses 0
    expect(monitor.check('new-agent', 60000).status).toBe('ok');
  });
});

describe('HeartbeatMonitor miss tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('increments miss count on consecutive misses', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 10000);

    vi.advanceTimersByTime(15000);
    expect(monitor.check('agent-1')).toEqual({ status: 'miss', count: 1 });

    vi.advanceTimersByTime(10000);
    expect(monitor.check('agent-1')).toEqual({ status: 'miss', count: 2 });

    vi.advanceTimersByTime(10000);
    expect(monitor.check('agent-1')).toEqual({ status: 'miss', count: 3 });
  });

  it('resets miss count when heartbeat received', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 10000);

    vi.advanceTimersByTime(15000);
    monitor.check('agent-1'); // miss 1

    vi.advanceTimersByTime(10000);
    monitor.check('agent-1'); // miss 2

    monitor.recordHeartbeat('agent-1');
    expect(monitor.check('agent-1').status).toBe('ok');
  });
});

describe('HeartbeatMonitor getOverdueAgents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when no agents overdue', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 60000);
    expect(monitor.getOverdueAgents()).toEqual([]);
  });

  it('returns overdue agents with miss counts', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 10000);
    monitor.register('agent-2', 20000);

    vi.advanceTimersByTime(15000);

    const overdue = monitor.getOverdueAgents();
    expect(overdue).toHaveLength(1);
    expect(overdue[0]?.agentId).toBe('agent-1');
    expect(overdue[0]?.missCount).toBe(1);
  });

  it('returns multiple overdue agents', () => {
    const monitor = new HeartbeatMonitor();
    monitor.register('agent-1', 10000);
    monitor.register('agent-2', 10000);

    vi.advanceTimersByTime(15000);

    const overdue = monitor.getOverdueAgents();
    expect(overdue).toHaveLength(2);
  });
});
