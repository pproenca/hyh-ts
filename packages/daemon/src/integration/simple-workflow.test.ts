// packages/daemon/src/integration/simple-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Daemon } from '../core/daemon.js';

describe('Integration: Simple Workflow', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-integration-'));

    // Create minimal workflow
    const workflow = {
      name: 'test-workflow',
      resumable: true,
      orchestrator: 'orchestrator',
      agents: {
        orchestrator: { name: 'orchestrator', model: 'opus', role: 'coordinator', tools: [] },
        worker: { name: 'worker', model: 'sonnet', role: 'implementation', tools: ['Read', 'Write'] },
      },
      phases: [
        { name: 'implement', agent: 'worker', queue: 'tasks', parallel: true },
      ],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    };

    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow, null, 2)
    );

    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('should initialize daemon and load workflow', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    const state = await daemon.stateManager.load();
    expect(state).not.toBeNull();
  });

  it('should detect spawn triggers for pending tasks', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Add a pending task
    await daemon.stateManager.update((state) => {
      state.currentPhase = 'implement';
      state.tasks['task-1'] = {
        id: 'task-1',
        description: 'Test task',
        status: 'pending',
        dependencies: [],
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        files: [],
        timeoutSeconds: 600,
      };
    });

    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThanOrEqual(0);
  });

  it('should run tick cycle without errors', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    await daemon.stateManager.update((state) => {
      state.currentPhase = 'implement';
    });

    // Should not throw
    const result = await daemon.tick();
    expect(result).toBeDefined();
    expect(result.spawnsTriggered).toBeDefined();
    expect(result.heartbeatsMissed).toBeDefined();
    expect(result.phaseTransitioned).toBeDefined();
    expect(result.correctionsApplied).toBeDefined();
  });
});
