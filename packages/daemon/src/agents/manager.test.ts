// packages/daemon/src/agents/manager.test.ts
import { describe, it, expect } from 'vitest';
import { AgentManager } from './manager.js';

describe('AgentManager', () => {
  it('registers and retrieves agents', () => {
    const manager = new AgentManager('/tmp/test');

    expect(manager.getActiveAgents()).toHaveLength(0);
  });

  it('generates unique agent IDs', () => {
    const manager = new AgentManager('/tmp/test');

    const id1 = manager.generateAgentId('worker', 'task-1');
    const id2 = manager.generateAgentId('worker', 'task-2');

    expect(id1).toContain('worker');
    expect(id2).toContain('worker');
    expect(id1).not.toBe(id2);
  });
});
