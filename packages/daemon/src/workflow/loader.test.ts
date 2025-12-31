// packages/daemon/src/workflow/loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowLoader } from './loader.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('WorkflowLoader', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    await fs.mkdir(path.join(testDir, '.hyh'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('loads compiled workflow from .hyh/workflow.json', async () => {
    const workflow = { name: 'test-workflow', phases: [{ name: 'test' }] };
    await fs.writeFile(
      path.join(testDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    const loader = new WorkflowLoader(testDir);
    const loaded = await loader.load();

    expect(loaded.name).toBe('test-workflow');
    expect(loaded.phases).toHaveLength(1);
  });

  it('checks if workflow exists', async () => {
    const loader = new WorkflowLoader(testDir);
    expect(await loader.exists()).toBe(false);

    await fs.writeFile(
      path.join(testDir, '.hyh', 'workflow.json'),
      '{}'
    );
    expect(await loader.exists()).toBe(true);
  });
});
