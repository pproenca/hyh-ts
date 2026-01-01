// packages/dsl/src/builders/phase.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseBuilder } from './phase.js';
import { agent } from './agent.js';
import { workflow } from './workflow.js';
import { queue } from './queue.js';
import { gate } from './gate.js';
import { human } from '../checkpoints/human.js';
import type { AgentBuilder } from './agent.js';
import type { CompiledWorkflow } from '../types/compiled.js';

// Mock interface matching WorkflowBuilderLike from phase.ts
interface MockWorkflowBuilder {
  addPhase: () => void;
  phase: (name: string) => PhaseBuilder;
  registerAgent: (agent: AgentBuilder) => void;
  build: () => CompiledWorkflow;
}

describe('PhaseBuilder', () => {
  // Create a self-referential mock that satisfies the interface
  const createMockWorkflow = (): MockWorkflowBuilder => {
    const mock: MockWorkflowBuilder = {
      addPhase: () => {},
      phase: (name: string) => new PhaseBuilder(name, mock),
      registerAgent: () => {},
      build: () => ({}) as CompiledWorkflow,
    };
    return mock;
  };
  const mockWorkflow = createMockWorkflow();

  it('creates phase with name', () => {
    const p = new PhaseBuilder('explore', mockWorkflow);
    expect(p.buildPhase().name).toBe('explore');
  });

  it('sets agent', () => {
    const orch = agent('orchestrator').model('opus');
    const p = new PhaseBuilder('explore', mockWorkflow).agent(orch);
    expect(p.buildPhase().agent).toBe('orchestrator');
  });

  it('sets expects and forbids', () => {
    const p = new PhaseBuilder('explore', mockWorkflow)
      .expects('Read', 'Grep')
      .forbids('Write', 'Edit');

    const built = p.buildPhase();
    expect(built.expects).toEqual(['Read', 'Grep']);
    expect(built.forbids).toEqual(['Write', 'Edit']);
  });

  it('sets outputs and requires', () => {
    const p = new PhaseBuilder('plan', mockWorkflow)
      .requires('architecture.md')
      .output('plan.md', 'tasks.md');

    const built = p.buildPhase();
    expect(built.requires).toEqual(['architecture.md']);
    expect(built.outputs).toEqual(['plan.md', 'tasks.md']);
  });
});

describe('PhaseBuilder.queue', () => {
  it('binds queue to phase', () => {
    const orch = agent('orch').model('sonnet');
    const tasks = queue('tasks');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .queue(tasks)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.queue).toBe('tasks');
  });
});

describe('PhaseBuilder.populates', () => {
  it('sets queue that phase populates', () => {
    const orch = agent('orch').model('sonnet');
    const tasks = queue('tasks');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('plan')
        .agent(orch)
        .populates(tasks)
      .build();

    const phase = result.phases.find(p => p.name === 'plan');
    expect(phase?.populates).toBe('tasks');
  });
});

describe('PhaseBuilder.parallel', () => {
  it('sets parallel to true when called without argument', () => {
    const orch = agent('orch').model('sonnet');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .parallel()
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.parallel).toBe(true);
  });

  it('sets parallel to specific count', () => {
    const orch = agent('orch').model('sonnet');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .parallel(5)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.parallel).toBe(5);
  });
});

describe('PhaseBuilder.gate', () => {
  it('binds gate to phase', () => {
    const orch = agent('orch').model('sonnet');
    const reviewGate = gate('code-review');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .gate(reviewGate)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.gate).toBe('code-review');
  });
});

describe('PhaseBuilder.then', () => {
  it('sets next queue for flow control', () => {
    const orch = agent('orch').model('sonnet');
    const nextQueue = queue('verification-tasks');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .then(nextQueue)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.then).toBe('verification-tasks');
  });
});

describe('PhaseBuilder.checkpoint', () => {
  it('sets human approval checkpoint', () => {
    const orch = agent('orch').model('sonnet');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('review')
        .agent(orch)
        .checkpoint(human.approval('Ready to proceed?'))
      .build();

    const phase = result.phases.find(p => p.name === 'review');
    expect(phase?.checkpoint).toBeDefined();
    expect(phase?.checkpoint?.type).toBe('approval');
    expect(phase?.checkpoint?.question).toBe('Ready to proceed?');
  });
});

describe('PhaseBuilder.onApprove', () => {
  it('stores onApprove action as string', () => {
    const orch = agent('orch').model('sonnet');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('complete')
        .agent(orch)
        .onApprove((ctx) => ctx.git.merge())
      .build();

    const phase = result.phases.find(p => p.name === 'complete');
    expect(phase?.onApprove).toBeDefined();
    expect(phase?.onApprove).toContain('ctx.git.merge');
  });

  it('stores async onApprove action', () => {
    const orch = agent('orch').model('sonnet');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('complete')
        .agent(orch)
        .onApprove(async (ctx) => {
          await ctx.git.commit('Final commit');
          await ctx.git.push();
        })
      .build();

    const phase = result.phases.find(p => p.name === 'complete');
    expect(phase?.onApprove).toContain('git.commit');
    expect(phase?.onApprove).toContain('git.push');
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
