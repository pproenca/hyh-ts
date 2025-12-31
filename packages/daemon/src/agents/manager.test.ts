// packages/daemon/src/agents/manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentManager } from './manager.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock the AgentProcess to avoid actually spawning Claude CLI
vi.mock('./process.js', () => {
  return {
    AgentProcess: vi.fn().mockImplementation((config) => {
      const eventHandlers: Map<string, ((...args: unknown[]) => void)[]> = new Map();
      return {
        agentId: config.agentId,
        model: config.model,
        sessionId: config.sessionId,
        isRunning: true,
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockImplementation(async function(this: { isRunning: boolean }) {
          this.isRunning = false;
          const handlers = eventHandlers.get('event') || [];
          handlers.forEach(h => h({ type: 'exit', data: { code: 0 } }));
        }),
        injectPrompt: vi.fn().mockResolvedValue(undefined),
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          if (!eventHandlers.has(event)) {
            eventHandlers.set(event, []);
          }
          eventHandlers.get(event)!.push(handler);
        }),
        emit: vi.fn(),
      };
    }),
  };
});

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

describe('AgentManager Lifecycle', () => {
  let tmpDir: string;
  let manager: AgentManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new AgentManager(tmpDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager.killAll();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('should spawn agent and receive events', async () => {
    const events: unknown[] = [];

    const agent = await manager.spawn({
      agentType: 'worker',
      taskId: 'task-1',
      model: 'sonnet',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Read', 'Write'],
    });

    agent.on('event', (e: unknown) => events.push(e));

    expect(agent.isRunning).toBe(true);
    expect(manager.get(agent.agentId)).toBe(agent);

    await agent.stop();
    expect(manager.get(agent.agentId)).toBeUndefined();
  });

  it('should track multiple agents', async () => {
    const agent1 = await manager.spawn({
      agentType: 'worker',
      taskId: 'task-1',
      model: 'sonnet',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Read'],
    });

    const agent2 = await manager.spawn({
      agentType: 'worker',
      taskId: 'task-2',
      model: 'haiku',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Write'],
    });

    expect(manager.get(agent1.agentId)).toBe(agent1);
    expect(manager.get(agent2.agentId)).toBe(agent2);
    expect(manager.getActiveAgents()).toHaveLength(2);
  });

  it('should stop all agents', async () => {
    await manager.spawn({
      agentType: 'worker',
      taskId: 'task-1',
      model: 'sonnet',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Read'],
    });

    await manager.spawn({
      agentType: 'worker',
      taskId: 'task-2',
      model: 'haiku',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Write'],
    });

    expect(manager.getActiveAgents().length).toBe(2);

    await manager.killAll();

    expect(manager.getActiveAgents()).toHaveLength(0);
  });
});
