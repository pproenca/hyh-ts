// packages/daemon/src/agents/process.test.ts
import { describe, it, expect } from 'vitest';
import { AgentProcess } from './process.js';

describe('AgentProcess', () => {
  it('creates agent with correct configuration', () => {
    const agent = new AgentProcess({
      agentId: 'worker-a1b2',
      model: 'sonnet',
      sessionId: 'test-session',
      systemPromptPath: '/tmp/prompt.md',
      tools: ['Read', 'Write', 'Edit'],
      cwd: '/tmp/test',
    });

    expect(agent.agentId).toBe('worker-a1b2');
    expect(agent.model).toBe('sonnet');
    expect(agent.isRunning).toBe(false);
  });
});
