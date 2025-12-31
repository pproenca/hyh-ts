// packages/dsl/src/types/compiled.test.ts
import { describe, it, expect } from 'vitest';
import type { CompiledWorkflow, CompiledPhase, ScalingConfig, PreCompactConfig } from './compiled.js';

describe('CompiledWorkflow extensions', () => {
  it('should accept scaling config', () => {
    const scaling: ScalingConfig = {
      trivial: { maxHours: 1, agents: 1 },
      small: { maxHours: 4, agents: 2 },
    };
    const workflow: Partial<CompiledWorkflow> = { scaling };
    expect(workflow.scaling?.trivial?.maxHours).toBe(1);
  });

  it('should accept preCompact config', () => {
    const preCompact: PreCompactConfig = {
      preserve: ['decisions', 'errors'],
      summarize: ['exploration'],
    };
    const workflow: Partial<CompiledWorkflow> = { preCompact };
    expect(workflow.preCompact?.preserve).toContain('decisions');
  });
});

describe('CompiledPhase extensions', () => {
  it('should accept contextBudget', () => {
    const phase: Partial<CompiledPhase> = { contextBudget: 15000 };
    expect(phase.contextBudget).toBe(15000);
  });
});
