// packages/daemon/src/state/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from './manager.js';
import { TaskStatus } from '../types/state.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

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
