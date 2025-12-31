// packages/daemon/src/integration/agent-spawn.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { AgentManager } from '../agents/manager.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Agent spawning integration', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-spawn-test-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should trigger agent spawn when tasks are ready', async () => {
    // Create workflow with pending task
    const workflow = {
      name: 'test',
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: true }],
      queues: { tasks: { ready: 'task.deps.allComplete' } },
      agents: { worker: { model: 'sonnet', tools: ['Read'] } },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Add a pending task
    await daemon.stateManager.update(s => {
      s.tasks = {
        'task-1': {
          id: 'task-1',
          description: 'Test task',
          status: 'pending',
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        }
      };
    });

    // Check spawn triggers
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
  });

  it('should have an AgentManager instance', () => {
    // Verify daemon has AgentManager integration
    expect(daemon.getAgentManager()).toBeInstanceOf(AgentManager);
  });

  it('should expose spawnAgents method', () => {
    // Verify daemon has spawnAgents method
    expect(typeof daemon.spawnAgents).toBe('function');
  });
});
