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
