// packages/daemon/src/workflow/spawn-trigger.test.ts
import { describe, it, expect } from 'vitest';
import { SpawnTriggerManager } from './spawn-trigger.js';

describe('SpawnTriggerManager', () => {
  it('triggers spawn when phase has queue with ready tasks', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 3 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(2);
    expect(spawns[0].taskId).toBe('T001');
  });

  it('respects parallel limit', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002', 'T003'],
      activeAgentCount: 1,
    });

    expect(spawns).toHaveLength(1); // 2 max - 1 active = 1 more
  });

  it('returns empty array for unknown phase', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 }],
      queues: {},
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'unknown',
      readyTasks: ['T001'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(0);
  });
});
