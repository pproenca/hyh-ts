// packages/dsl/src/index.test.ts
import { describe, it, expect } from 'vitest';
import * as dsl from './index.js';

describe('DSL exports', () => {
  it('should export ScalingConfig type via CompiledWorkflow', () => {
    // Type check - if this compiles, export works
    const workflow: dsl.CompiledWorkflow = {
      name: 'test',
      resumable: false,
      orchestrator: 'orch',
      agents: {},
      phases: [],
      queues: {},
      gates: {},
      scaling: { small: { maxHours: 2, agents: 1 } },
    };
    expect(workflow.scaling?.small?.agents).toBe(1);
  });

  it('should export defineConfig', () => {
    expect(typeof dsl.defineConfig).toBe('function');
  });
});
