// packages/dsl/src/builders/phase.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseBuilder } from './phase.js';
import { agent } from './agent.js';

describe('PhaseBuilder', () => {
  const mockWorkflow = {
    addPhase: () => {},
    phase: () => new PhaseBuilder('test', {} as any),
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
