// packages/dsl/src/compiler/compiler.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from './index.js';
import { workflow, agent, queue, inv, correct } from '../index.js';

describe('DSL Compiler', () => {
  it('compiles workflow to JSON structure', () => {
    const orchestrator = agent('orchestrator')
      .model('opus')
      .role('coordinator')
      .tools('Read', 'Grep');

    const wf = workflow('test-feature')
      .resumable()
      .orchestrator(orchestrator)
      .phase('explore')
        .agent(orchestrator)
        .expects('Read', 'Grep')
        .forbids('Write')
        .output('architecture.md')
      .build();

    const compiled = compile(wf);

    expect(compiled.name).toBe('test-feature');
    expect(compiled.resumable).toBe(true);
    expect(compiled.orchestrator).toBe('orchestrator');
    expect(compiled.phases).toHaveLength(1);
    expect(compiled.phases[0].expects).toContain('Read');
  });
});
