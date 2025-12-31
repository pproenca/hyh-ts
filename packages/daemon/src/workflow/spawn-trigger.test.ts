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

describe('SpawnTriggerManager parallel modes', () => {
  it('treats parallel=true as unlimited', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: true }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002', 'T003', 'T004', 'T005'],
      activeAgentCount: 2,
    });

    expect(spawns).toHaveLength(5);
  });

  it('treats missing parallel as 1', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker' }], // no parallel
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002', 'T003'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(1);
  });

  it('spawns nothing when at capacity', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002'],
      activeAgentCount: 2,
    });

    expect(spawns).toHaveLength(0);
  });
});

describe('SpawnTriggerManager phase requirements', () => {
  it('returns empty when phase has no queue', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'plan', agent: 'worker' }], // no queue
      queues: {},
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'plan',
      readyTasks: ['T001'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(0);
  });

  it('returns empty when phase has no agent', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'plan', queue: 'tasks' }], // no agent
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'plan',
      readyTasks: ['T001'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(0);
  });
});

describe('SpawnTriggerManager spawn specs', () => {
  it('includes correct agent type in spawn spec', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'developer', parallel: 5 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001'],
      activeAgentCount: 0,
    });

    expect(spawns[0]!.agentType).toBe('developer');
    expect(spawns[0]!.taskId).toBe('T001');
  });

  it('preserves task order in spawns', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 5 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T003', 'T001', 'T002'],
      activeAgentCount: 0,
    });

    expect(spawns[0]!.taskId).toBe('T003');
    expect(spawns[1]!.taskId).toBe('T001');
    expect(spawns[2]!.taskId).toBe('T002');
  });
});
