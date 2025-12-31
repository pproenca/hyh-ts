// packages/daemon/src/core/agent-lifecycle.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentLifecycle } from './agent-lifecycle.js';

describe('AgentLifecycle', () => {
  it('spawns agents via agent manager', async () => {
    const mockSpawn = vi.fn().mockResolvedValue({ agentId: 'test-1' });
    const lifecycle = new AgentLifecycle({
      agentManager: { spawn: mockSpawn } as any,
      stateManager: { load: vi.fn(), update: vi.fn() } as any,
      trajectory: { log: vi.fn() } as any,
      heartbeatMonitor: { recordHeartbeat: vi.fn(), getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
    });

    await lifecycle.spawn([{ agentName: 'test-1', model: 'sonnet' }]);

    expect(mockSpawn).toHaveBeenCalled();
  });

  it('tracks spawned agents', async () => {
    const lifecycle = new AgentLifecycle({
      agentManager: { spawn: vi.fn().mockResolvedValue({ agentId: 'test-1' }) } as any,
      stateManager: { load: vi.fn(), update: vi.fn() } as any,
      trajectory: { log: vi.fn() } as any,
      heartbeatMonitor: { recordHeartbeat: vi.fn(), getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
    });

    const mockAgent = { id: 'test-1', kill: vi.fn() };
    lifecycle.setAgent('test-1', mockAgent as any);

    expect(lifecycle.getAgent('test-1')).toBe(mockAgent);
  });

  it('records heartbeats', () => {
    const mockRecord = vi.fn();
    const lifecycle = new AgentLifecycle({
      agentManager: {} as any,
      stateManager: {} as any,
      trajectory: {} as any,
      heartbeatMonitor: { recordHeartbeat: mockRecord, getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
    });

    lifecycle.recordHeartbeat('agent-1');

    expect(mockRecord).toHaveBeenCalledWith('agent-1');
  });
});
