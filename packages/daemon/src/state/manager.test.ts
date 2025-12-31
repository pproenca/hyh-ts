// packages/daemon/src/state/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from './manager.js';
import { TaskStatus } from '../types/state.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StateManager.recoverFromCrash', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return null state when no state file exists', async () => {
    const result = await manager.recoverFromCrash();
    expect(result.state).toBeNull();
    expect(result.repaired).toEqual([]);
  });

  it('should detect orphaned running tasks with stale timestamps', async () => {
    const staleTime = Date.now() - 700_000; // 700 seconds ago (> 600s timeout)
    const state = {
      workflowId: 'test',
      workflowName: 'test',
      startedAt: staleTime,
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          description: 'Orphaned task',
          status: TaskStatus.RUNNING,
          dependencies: [],
          timeoutSeconds: 600,
          claimedBy: 'dead-worker',
          startedAt: staleTime,
          claimedAt: staleTime,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };
    await manager.save(state);

    const result = await manager.recoverFromCrash();

    expect(result.repaired.length).toBeGreaterThan(0);
    expect(result.repaired[0]?.type).toBe('orphaned_task');
    expect(result.state?.tasks['task-1']?.status).toBe(TaskStatus.PENDING);
    expect(result.state?.tasks['task-1']?.claimedBy).toBeNull();
  });

  it('should not modify healthy running tasks', async () => {
    const recentTime = Date.now() - 30_000; // 30 seconds ago
    const state = {
      workflowId: 'test',
      workflowName: 'test',
      startedAt: recentTime,
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          description: 'Active task',
          status: TaskStatus.RUNNING,
          dependencies: [],
          timeoutSeconds: 600,
          claimedBy: 'active-worker',
          startedAt: recentTime,
          claimedAt: recentTime,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };
    await manager.save(state);

    const result = await manager.recoverFromCrash();

    expect(result.repaired).toEqual([]);
    expect(result.state?.tasks['task-1']?.status).toBe(TaskStatus.RUNNING);
  });
});

describe('StateManager', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns null when no state file exists', async () => {
    const state = await manager.load();
    expect(state).toBeNull();
  });

  it('saves and loads state', async () => {
    const state = {
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: TaskStatus.PENDING,
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
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    await manager.save(state);
    const loaded = await manager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.workflowId).toBe('wf-1');
    expect(loaded!.tasks['T001']!.description).toBe('Setup');
  });

  it('claims task atomically', async () => {
    // Setup initial state
    await manager.save({
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: TaskStatus.PENDING,
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
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    });

    const result = await manager.claimTask('worker-1');
    expect(result.task).not.toBeNull();
    expect(result.task!.id).toBe('T001');
    expect(result.task!.claimedBy).toBe('worker-1');
    expect(result.task!.status).toBe(TaskStatus.RUNNING);
  });
});

describe('StateManager atomic writes', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes state file atomically using temp file rename', async () => {
    const state = {
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    await manager.save(state);

    // State file should exist at .hyh/state.json
    const statePath = path.join(tempDir, '.hyh', 'state.json');
    const exists = await fs.access(statePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Content should be valid JSON
    const content = await fs.readFile(statePath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('update callback is applied atomically', async () => {
    // Setup initial state
    await manager.save({
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'phase1',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    });

    await manager.update((state) => {
      state.currentPhase = 'phase2';
      return state;
    });

    const loaded = await manager.load();
    expect(loaded?.currentPhase).toBe('phase2');
  });

  it('handles concurrent updates safely', async () => {
    // Setup initial state with counter-like data
    await manager.save({
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Task 1',
          status: TaskStatus.PENDING,
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
        'T002': {
          id: 'T002',
          description: 'Task 2',
          status: TaskStatus.PENDING,
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
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    });

    // Simulate two workers claiming tasks simultaneously
    const [result1, result2] = await Promise.all([
      manager.claimTask('worker-1'),
      manager.claimTask('worker-2'),
    ]);

    // Both should succeed with different tasks
    const claimed = [result1.task?.id, result2.task?.id].filter(Boolean);
    expect(claimed.length).toBe(2);
    expect(new Set(claimed).size).toBe(2); // No duplicates
  });
});

describe('StateManager complete task', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);

    // Setup initial state with a running task
    await manager.save({
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Task 1',
          status: TaskStatus.RUNNING,
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
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('marks task as completed', async () => {
    await manager.completeTask('T001', 'worker-1');

    const state = await manager.load();
    expect(state?.tasks['T001']?.status).toBe(TaskStatus.COMPLETED);
    expect(state?.tasks['T001']?.completedAt).not.toBeNull();
  });

  it('rejects completion from wrong worker', async () => {
    await expect(manager.completeTask('T001', 'wrong-worker')).rejects.toThrow();

    const state = await manager.load();
    expect(state?.tasks['T001']?.status).toBe(TaskStatus.RUNNING);
  });
});
