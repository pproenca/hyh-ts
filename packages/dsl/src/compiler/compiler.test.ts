// packages/dsl/src/compiler/compiler.test.ts
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { compile, compileToDir } from './index.js';
import { workflow, agent } from '../index.js';

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

describe('compileToDir', () => {
  it('writes workflow.json to output directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));

    const orchestrator = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orchestrator)
      .phase('plan')
        .agent(orchestrator)
      .build();

    await compileToDir(wf, tmpDir);

    const workflowJson = await fs.readFile(
      path.join(tmpDir, 'workflow.json'),
      'utf-8'
    );
    const parsed = JSON.parse(workflowJson);
    expect(parsed.name).toBe('test');

    // Cleanup
    await fs.rm(tmpDir, { recursive: true });
  });
});

describe('compileToDir with all artifacts', () => {
  it('writes workflow.json, agent prompts, and hooks.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));

    const orchestrator = agent('orchestrator').model('opus').role('coordinator');
    const worker = agent('worker').model('sonnet').role('implementation');

    const wf = workflow('test')
      .orchestrator(orchestrator)
      .phase('plan').agent(orchestrator)
      .phase('impl').agent(worker)
      .build();

    // Register worker agent
    wf.agents['worker'] = worker.build();

    await compileToDir(wf, tmpDir);

    // Check all files exist
    const files = await fs.readdir(tmpDir);
    expect(files).toContain('workflow.json');
    expect(files).toContain('hooks.json');

    const agentsDir = await fs.readdir(path.join(tmpDir, 'agents'));
    expect(agentsDir).toContain('orchestrator.md');
    expect(agentsDir).toContain('worker.md');

    await fs.rm(tmpDir, { recursive: true });
  });
});
