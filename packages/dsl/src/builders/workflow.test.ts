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
