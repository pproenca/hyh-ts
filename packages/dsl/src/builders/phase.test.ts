// packages/dsl/src/builders/phase.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseBuilder } from './phase.js';
import { agent } from './agent.js';
import { workflow } from './workflow.js';

describe('PhaseBuilder', () => {
  const mockWorkflow = {
    addPhase: () => {},
    phase: () => new PhaseBuilder('test', {} as any),
    registerAgent: () => {},
    build: () => ({} as any),
  };

  it('creates phase with name', () => {
    const p = new PhaseBuilder('explore', mockWorkflow as any);
    expect(p.buildPhase().name).toBe('explore');
  });

  it('sets agent', () => {
    const orch = agent('orchestrator').model('opus');
    const p = new PhaseBuilder('explore', mockWorkflow as any).agent(orch);
    expect(p.buildPhase().agent).toBe('orchestrator');
  });

  it('sets expects and forbids', () => {
    const p = new PhaseBuilder('explore', mockWorkflow as any)
      .expects('Read', 'Grep')
      .forbids('Write', 'Edit');

    const built = p.buildPhase();
    expect(built.expects).toEqual(['Read', 'Grep']);
    expect(built.forbids).toEqual(['Write', 'Edit']);
  });

  it('sets outputs and requires', () => {
    const p = new PhaseBuilder('plan', mockWorkflow as any)
      .requires('architecture.md')
      .output('plan.md', 'tasks.md');

    const built = p.buildPhase();
    expect(built.requires).toEqual(['architecture.md']);
    expect(built.outputs).toEqual(['plan.md', 'tasks.md']);
  });
});

describe('PhaseBuilder.contextBudget', () => {
  it('should set context budget on phase', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .contextBudget(15000)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.contextBudget).toBe(15000);
  });

  it('should allow different budgets per phase', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('plan')
        .agent(orch)
        .contextBudget(10000)
      .phase('implement')
        .agent(orch)
        .contextBudget(20000)
      .build();

    expect(result.phases[0]?.contextBudget).toBe(10000);
    expect(result.phases[1]?.contextBudget).toBe(20000);
  });
});
