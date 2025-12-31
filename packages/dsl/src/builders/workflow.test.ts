// packages/dsl/src/builders/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { workflow } from './workflow.js';
import { agent } from './agent.js';
import { queue } from './queue.js';

describe('WorkflowBuilder', () => {
  it('creates workflow with name', () => {
    const w = workflow('feature').build();
    expect(w.name).toBe('feature');
  });

  it('sets resumable', () => {
    const w = workflow('feature').resumable().build();
    expect(w.resumable).toBe(true);
  });

  it('sets orchestrator', () => {
    const orch = agent('orchestrator').model('opus');
    const w = workflow('feature').orchestrator(orch).build();
    expect(w.orchestrator).toBe('orchestrator');
  });

  it('chains phases fluently', () => {
    const orch = agent('orchestrator').model('opus');
    const tasks = queue('tasks');

    const w = workflow('feature')
      .orchestrator(orch)
      .phase('explore')
        .agent(orch)
        .expects('Read', 'Grep')
        .forbids('Write')
      .phase('plan')
        .agent(orch)
        .populates(tasks)
      .build();

    expect(w.phases).toHaveLength(2);
    expect(w.phases[0]!.name).toBe('explore');
    expect(w.phases[1]!.name).toBe('plan');
  });
});

describe('WorkflowBuilder.scaling', () => {
  it('should set scaling config', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .scaling({
        trivial: { maxHours: 1, agents: 1 },
        small: { maxHours: 4, agents: 2 },
      })
      .phase('p1').agent(orch)
      .build();

    expect(result.scaling?.trivial?.maxHours).toBe(1);
    expect(result.scaling?.small?.agents).toBe(2);
  });
});

describe('WorkflowBuilder.preCompact', () => {
  it('should set preCompact config', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .preCompact({
        preserve: ['decisions', 'errors'],
        summarize: ['exploration'],
        discard: ['verbose_logs'],
      })
      .phase('p1').agent(orch)
      .build();

    expect(result.preCompact?.preserve).toContain('decisions');
    expect(result.preCompact?.summarize).toContain('exploration');
    expect(result.preCompact?.discard).toContain('verbose_logs');
  });
});
