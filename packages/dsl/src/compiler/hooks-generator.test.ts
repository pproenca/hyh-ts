// packages/dsl/src/compiler/hooks-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateHooksJson } from './hooks-generator.js';
import { workflow, agent } from '../index.js';

describe('generateHooksJson', () => {
  it('generates hooks config with SessionStart and Stop', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks).toBeDefined();
    expect(hooks.hooks.SessionStart).toBeDefined();
    expect(hooks.hooks.Stop).toBeDefined();
  });
});
