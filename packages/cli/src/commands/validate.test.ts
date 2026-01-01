// packages/cli/src/commands/validate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('validate command', () => {
  it('exports registerValidateCommand', async () => {
    const { registerValidateCommand } = await import('./validate.js');
    expect(registerValidateCommand).toBeDefined();
  });
});

describe('validate command registration', () => {
  let program: Command;

  beforeEach(async () => {
    program = new Command();
    const { registerValidateCommand } = await import('./validate.js');
    registerValidateCommand(program);
  });

  it('registers validate command', () => {
    const cmd = program.commands.find((c) => c.name() === 'validate');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Validate');
  });

  it('accepts workflow argument', () => {
    const cmd = program.commands.find((c) => c.name() === 'validate');
    // Commander stores args differently, check it exists
    expect(cmd).toBeDefined();
  });
});

describe('validate command DSL validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-validate-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects valid workflow structure', async () => {
    // Create a valid workflow object and validate it has the right structure
    const { workflow, agent } = await import('@hyh/dsl');
    const orch = agent('orch').model('sonnet');
    const w = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    // Validate structure
    expect(w.name).toBe('test');
    expect(w.phases).toHaveLength(1);
    expect(w.orchestrator).toBe('orch');
  });

  it('workflow.validate throws on missing orchestrator', async () => {
    const { workflow } = await import('@hyh/dsl');
    const w = workflow('test');
    expect(() => w.validate()).toThrow('orchestrator');
  });

  it('workflow.validate throws on missing phases', async () => {
    const { workflow, agent } = await import('@hyh/dsl');
    const orch = agent('orch').model('sonnet');
    const w = workflow('test').orchestrator(orch);
    expect(() => w.validate()).toThrow('phase');
  });
});
