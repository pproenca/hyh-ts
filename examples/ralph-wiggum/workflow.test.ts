// examples/ralph-wiggum/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '@hyh/dsl';
import { ralphWiggumWorkflow } from './workflow.js';

describe('Ralph Wiggum Workflow', () => {
  it('compiles without errors', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(compiled.name).toBe('ralph-wiggum');
  });

  it('has four phases', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(compiled.phases).toHaveLength(4);
    expect(compiled.phases.map(p => p.name)).toEqual([
      'discovery',
      'refinement',
      'planning',
      'implementation',
    ]);
  });

  it('has three agents', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(Object.keys(compiled.agents)).toHaveLength(3);
    expect(compiled.agents['interviewer']).toBeDefined();
    expect(compiled.agents['refiner']).toBeDefined();
    expect(compiled.agents['implementer']).toBeDefined();
  });

  it('all agents use opus model', () => {
    const compiled = compile(ralphWiggumWorkflow);
    for (const agent of Object.values(compiled.agents)) {
      expect(agent.model).toBe('opus');
    }
  });

  it('discovery phase forbids Write and Edit', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const discovery = compiled.phases.find(p => p.name === 'discovery');
    expect(discovery?.forbids).toContain('Write');
    expect(discovery?.forbids).toContain('Edit');
  });

  it('implementation phase has TDD invariant', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const implementer = compiled.agents['implementer'];
    const tddInv = implementer?.rules.find(i => i.type === 'tdd');
    expect(tddInv).toBeDefined();
  });

  it('has human checkpoints between phases', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const refinement = compiled.phases.find(p => p.name === 'refinement');
    expect(refinement?.checkpoint).toBeDefined();
    expect(refinement?.checkpoint?.type).toBe('approval');
  });
});
