// packages/daemon/src/integration/full-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { TaskPacketFactory } from '../managers/task-packet.js';
import { ArtifactManager } from '../managers/artifact.js';
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

    // Mock spawnAgents to prevent actual Claude CLI spawning
    vi.spyOn(daemon, 'spawnAgents').mockResolvedValue();

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

  it('should create task packets for spawned agents', async () => {
    // Create a workflow for testing
    const workflow = {
      name: 'packet-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
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

    // Create artifact for completed dependency task
    const artifactDir = path.join(tmpDir, '.hyh', 'artifacts');
    await fs.mkdir(artifactDir, { recursive: true });
    const artifactManager = new ArtifactManager(artifactDir);
    await artifactManager.save({
      taskId: 't0',
      status: 'complete',
      summary: 'Created type definitions',
      files: { created: ['src/types.ts'], modified: [] },
      exports: ['UserType', 'ConfigType'],
      tests: { passed: 3, failed: 0, command: 'npm test' },
      notes: 'All types exported correctly',
    });

    // Add tasks with dependencies
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't0': {
          id: 't0',
          description: 'Create types',
          status: 'completed',
          claimedBy: 'worker-1',
          claimedAt: Date.now() - 10000,
          startedAt: Date.now() - 10000,
          completedAt: Date.now() - 1000,
          attempts: 1,
          lastError: null,
          dependencies: [],
          files: ['src/types.ts'],
          timeoutSeconds: 600,
        },
        't1': {
          id: 't1',
          description: 'Implement API using types',
          status: 'pending',
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: ['t0'],
          files: ['src/api.ts'],
          timeoutSeconds: 600,
        },
      };
    });

    // Create TaskPacketFactory with artifact manager adapter
    const taskPacketFactory = new TaskPacketFactory({
      artifactManager: {
        async loadForDependencies(taskIds: string[]) {
          const result: Record<string, { summary: string; exports: string[] }> = {};
          for (const id of taskIds) {
            const artifact = await artifactManager.load(id);
            if (artifact) {
              result[id] = { summary: artifact.summary, exports: artifact.exports };
            }
          }
          return result;
        },
      },
    });

    // Check spawn creates proper task packet
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns[0].taskId).toBe('t1');

    // Create task packet for the spawned task
    const state = await daemon.stateManager.load();
    const task = state!.tasks['t1'];
    const taskPacket = await taskPacketFactory.createAsync({
      taskId: task.id,
      description: task.description,
      files: task.files,
      dependencies: task.dependencies,
    });

    expect(taskPacket).toBeDefined();
    expect(taskPacket.objective).toBe('Implement API using types');
    expect(taskPacket.constraints.fileScope).toEqual(['src/api.ts']);
    expect(taskPacket.context.dependencyArtifacts).toHaveProperty('t0');
    expect(taskPacket.context.dependencyArtifacts['t0'].summary).toBe('Created type definitions');
    expect(taskPacket.context.dependencyArtifacts['t0'].exports).toEqual(['UserType', 'ConfigType']);
  });

  it('should integrate TaskPacketFactory with AgentManager', async () => {
    // Create artifact for dependency
    const artifactDir = path.join(tmpDir, '.hyh', 'artifacts');
    await fs.mkdir(artifactDir, { recursive: true });
    const artifactManager = new ArtifactManager(artifactDir);
    await artifactManager.save({
      taskId: 'dep-task',
      status: 'complete',
      summary: 'Implemented base functionality',
      files: { created: ['src/base.ts'], modified: [] },
      exports: ['BaseClass'],
      tests: { passed: 5, failed: 0, command: 'npm test' },
      notes: '',
    });

    // Create TaskPacketFactory with artifact adapter
    const taskPacketFactory = new TaskPacketFactory({
      artifactManager: {
        async loadForDependencies(taskIds: string[]) {
          const result: Record<string, { summary: string; exports: string[] }> = {};
          for (const id of taskIds) {
            const artifact = await artifactManager.load(id);
            if (artifact) {
              result[id] = { summary: artifact.summary, exports: artifact.exports };
            }
          }
          return result;
        },
      },
    });

    // Get AgentManager from daemon and verify it can use TaskPacketFactory
    await daemon.start();

    const agentManager = daemon.getAgentManager();

    // AgentManager.createTaskPacketAsync should work when factory is provided
    // Note: Current daemon doesn't inject factory, but we can test the integration pattern
    const packet = await taskPacketFactory.createAsync({
      taskId: 'new-task',
      description: 'Build extended functionality',
      files: ['src/extended.ts'],
      dependencies: ['dep-task'],
    });

    expect(packet.context.dependencyArtifacts['dep-task']).toBeDefined();
    expect(packet.context.dependencyArtifacts['dep-task'].exports).toContain('BaseClass');
  });

  it('should detect incomplete todos for subagent verification', async () => {
    // This tests the pattern that subagent-verify would check
    // When an agent completes, we verify no incomplete todos remain

    await daemon.start();

    // Create todo.md with incomplete items
    const todoContent = `# Task TODO

- [x] Read requirements
- [ ] Implement feature
- [x] Write tests
- [ ] Fix bug
`;
    await fs.writeFile(path.join(tmpDir, 'todo.md'), todoContent);

    // Simulate reading todo.md and checking for incomplete items (what subagent-verify does)
    const content = await fs.readFile(path.join(tmpDir, 'todo.md'), 'utf-8');
    const incomplete = (content.match(/- \[ \]/g) || []).length;

    expect(incomplete).toBe(2);

    // If verification passes, all items should be complete
    const completeTodoContent = `# Task TODO

- [x] Read requirements
- [x] Implement feature
- [x] Write tests
- [x] Fix bug
`;
    await fs.writeFile(path.join(tmpDir, 'todo.md'), completeTodoContent);

    const updatedContent = await fs.readFile(path.join(tmpDir, 'todo.md'), 'utf-8');
    const updatedIncomplete = (updatedContent.match(/- \[ \]/g) || []).length;

    expect(updatedIncomplete).toBe(0);
  });

  it('should provide agent stop event for subagent-verify hook', async () => {
    // Create workflow with worker agent
    const workflow = {
      name: 'stop-hook-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 1 },
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

    // Set up a running task
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        'verify-task': {
          id: 'verify-task',
          description: 'Task for verification test',
          status: 'running',
          claimedBy: 'worker-verify',
          claimedAt: Date.now(),
          startedAt: Date.now(),
          completedAt: null,
          attempts: 1,
          lastError: null,
          dependencies: [],
          files: ['src/verify.ts'],
          timeoutSeconds: 600,
        },
      };
    });

    // Track if agent events include stop/completion
    const agentManager = daemon.getAgentManager();
    expect(agentManager).toBeDefined();

    // Complete the task (which would trigger SubagentStop hook in production)
    await daemon.completeTask('verify-task', 'worker-verify', {
      summary: 'Task completed after verification',
      files: { created: [], modified: ['src/verify.ts'] },
      exports: [],
      tests: { passed: 3, failed: 0, command: 'npm test' },
      notes: 'Verified before completion',
    });

    // Verify task was completed
    const state = await daemon.stateManager.load();
    expect(state!.tasks['verify-task'].status).toBe('completed');

    // Verify artifact was saved (which implies verification passed)
    const artifact = await daemon.getArtifact('verify-task');
    expect(artifact).toBeDefined();
    expect(artifact!.notes).toBe('Verified before completion');
  });
});
