// packages/cli/src/commands/metrics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerMetricsCommand } from './metrics.js';

describe('hyh metrics', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerMetricsCommand(program);
    vi.clearAllMocks();
  });

  it('should register metrics command', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('metrics');
  });

  it('should accept --format option', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    const formatOpt = cmd?.options.find((o) => o.long === '--format');
    expect(formatOpt).toBeDefined();
  });

  it('should accept --output option', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    const outputOpt = cmd?.options.find((o) => o.long === '--output');
    expect(outputOpt).toBeDefined();
  });
});
