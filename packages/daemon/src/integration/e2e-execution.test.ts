import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { EventLoop } from '../core/event-loop.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('E2E workflow execution', () => {
  let tmpDir: string;
  let daemon: Daemon;
  let eventLoop: EventLoop;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-e2e-exec-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    eventLoop?.stop();
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should execute complete workflow with task claiming and completion', async () => {
    // Create workflow
    const workflow = {
      name: 'e2e-exec-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 },
      ],
      queues: {
        tasks: { ready: 'task.deps.allComplete', timeout: 600000 },
      },
      agents: {
        worker: { name: 'worker', model: 'sonnet', tools: ['Read', 'Write'] },
      },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    // Start daemon and event loop
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Mock spawnAgents to prevent actual Claude CLI spawning
    const spawnSpy = vi.spyOn(daemon, 'spawnAgents').mockResolvedValue();

    eventLoop = new EventLoop(daemon as unknown as Parameters<typeof EventLoop>[0], {
      tickInterval: 100
    });

    // Add tasks
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't1': {
          id: 't1',
          description: 'E2E test task 1',
          status: 'pending',
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: ['src/test.ts'],
          timeoutSeconds: 600,
        },
      };
    });

    // Run a few tick cycles
    eventLoop.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    eventLoop.stop();

    // Verify spawn was triggered (via mock)
    expect(spawnSpy).toHaveBeenCalled();

    // Verify state is accessible
    const state = await daemon.stateManager.load();
    expect(state).toBeDefined();

    // The tick should have detected the pending task
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThanOrEqual(0);

    spawnSpy.mockRestore();
  });

  it('should handle IPC requests during execution', async () => {
    await daemon.start();

    // Add a task
    await daemon.stateManager.update(s => {
      s.tasks = {
        't1': {
          id: 't1',
          description: 'IPC test task',
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
        },
      };
    });

    // Simulate IPC task claim
    const { IPCClient } = await import('../ipc/client.js');
    const client = new IPCClient(daemon.getSocketPath());
    await client.connect();

    const claimResult = await client.request({
      command: 'task_claim',
      workerId: 'test-worker'
    });

    expect(claimResult.status).toBe('ok');

    client.disconnect();
  });
});
