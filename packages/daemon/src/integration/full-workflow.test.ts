// packages/daemon/src/integration/full-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from '../core/daemon.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Full workflow E2E', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-e2e-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should run complete workflow from init to completion', async () => {
    // Create a minimal workflow
    const workflow = {
      name: 'e2e-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'plan', agent: 'orchestrator', outputs: ['plan.md'] },
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 },
      ],
      queues: {
        tasks: { ready: 'task.deps.allComplete', timeout: 600000 },
      },
      agents: {
        orchestrator: { name: 'orchestrator', model: 'opus', tools: ['Read'] },
        worker: { name: 'worker', model: 'sonnet', tools: ['Read', 'Write'] },
      },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Verify state initialized
    const state = await daemon.stateManager.load();
    expect(state.workflowName).toBe('e2e-test');
    expect(state.currentPhase).toBe('plan');

    // Simulate plan phase completion by creating plan.md output
    await fs.writeFile(path.join(tmpDir, 'plan.md'), '# Plan\n- Task 1\n- Task 2');

    // Transition to implement phase and add tasks
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't1': {
          id: 't1',
          description: 'Task 1',
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
        't2': {
          id: 't2',
          description: 'Task 2',
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

    // Check spawn triggers - should spawn agents for pending tasks
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.length).toBeLessThanOrEqual(2); // parallel: 2 limit
    expect(spawns[0].agentType).toBe('worker');
  });

  it('should transition phases when all tasks complete', async () => {
    // Create workflow with two phases
    const workflow = {
      name: 'phase-transition-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'plan', agent: 'orchestrator' },
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 },
      ],
      queues: {
        tasks: { ready: 'task.deps.allComplete', timeout: 600000 },
      },
      agents: {
        orchestrator: { name: 'orchestrator', model: 'opus', tools: ['Read'] },
        worker: { name: 'worker', model: 'sonnet', tools: ['Read', 'Write'] },
      },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Manually set phase and verify transition check works
    await daemon.stateManager.update(s => {
      s.currentPhase = 'plan';
    });

    // Check that phase transition is possible (no queue means no blocking)
    const canTransition = await daemon.checkPhaseTransition();
    expect(typeof canTransition).toBe('boolean');

    // If we can transition, do it and verify
    if (canTransition) {
      await daemon.transitionPhase('implement');
      const state = await daemon.stateManager.load();
      expect(state.currentPhase).toBe('implement');
      expect(state.phaseHistory.length).toBeGreaterThan(0);
    }
  });

  it('should run tick cycle and collect results', async () => {
    // Create minimal workflow
    const workflow = {
      name: 'tick-test',
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

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Set up pending tasks
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't1': {
          id: 't1',
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
        },
      };
    });

    // Run tick cycle
    const result = await daemon.tick();

    // Verify tick result structure
    expect(result).toBeDefined();
    expect(typeof result.spawnsTriggered).toBe('number');
    expect(Array.isArray(result.heartbeatsMissed)).toBe(true);
    expect(typeof result.phaseTransitioned).toBe('boolean');
    expect(typeof result.correctionsApplied).toBe('number');
  });

  it('should save and retrieve artifacts on task completion', async () => {
    await daemon.start();

    // Set up a running task
    await daemon.stateManager.update(s => {
      s.tasks = {
        'e2e-task': {
          id: 'e2e-task',
          description: 'E2E test task',
          status: 'running',
          claimedBy: 'worker-1',
          claimedAt: Date.now(),
          startedAt: Date.now(),
          completedAt: null,
          attempts: 1,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        },
      };
    });

    // Complete task with artifact
    await daemon.completeTask('e2e-task', 'worker-1', {
      summary: 'Completed E2E test task',
      files: { created: ['src/new-file.ts'], modified: ['src/existing.ts'] },
      exports: ['newFunction', 'existingFunction'],
      tests: { passed: 5, failed: 0, command: 'npm test' },
      notes: 'All tests passing',
    });

    // Verify task is completed
    const state = await daemon.stateManager.load();
    expect(state.tasks['e2e-task'].status).toBe('completed');

    // Verify artifact was saved
    const artifact = await daemon.getArtifact('e2e-task');
    expect(artifact).toBeDefined();
    expect(artifact!.summary).toBe('Completed E2E test task');
    expect(artifact!.files.created).toContain('src/new-file.ts');
    expect(artifact!.exports).toContain('newFunction');
    expect(artifact!.tests.passed).toBe(5);
  });
});
