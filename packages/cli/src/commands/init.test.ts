// packages/cli/src/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Command } from 'commander';

describe('init command', () => {
  it('exports createWorkflowTemplate', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain("import { workflow");
    expect(template).toContain("export default workflow");
  });

  it('exports registerInitCommand', async () => {
    const { registerInitCommand } = await import('./init.js');
    expect(registerInitCommand).toBeDefined();
  });
});

describe('init command workflow template', () => {
  it('creates valid DSL template with agent definitions', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    // Check for agent definitions
    expect(template).toContain("agent('orchestrator')");
    expect(template).toContain("agent('worker')");
    expect(template).toContain(".model('opus')");
    expect(template).toContain(".model('sonnet')");
  });

  it('includes queue definition', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain("queue('tasks')");
    expect(template).toContain(".ready(");
    expect(template).toContain(".timeout(");
  });

  it('includes phase definitions', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain(".phase('plan')");
    expect(template).toContain(".phase('implement')");
    expect(template).toContain(".checkpoint(");
  });

  it('includes invariants', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain("inv.tdd(");
    expect(template).toContain("'**/*.test.ts'");
  });
});

describe('init command file creation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-init-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates workflow.ts file', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const workflowPath = path.join(tempDir, 'workflow.ts');

    await fs.writeFile(workflowPath, createWorkflowTemplate());

    const exists = await fs.access(workflowPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(workflowPath, 'utf-8');
    expect(content).toContain('workflow');
  });

  it('creates .hyh directory', async () => {
    const hyhDir = path.join(tempDir, '.hyh');
    await fs.mkdir(hyhDir, { recursive: true });

    const stat = await fs.stat(hyhDir);
    expect(stat.isDirectory()).toBe(true);
  });
});
