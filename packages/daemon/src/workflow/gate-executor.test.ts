// packages/daemon/src/workflow/gate-executor.test.ts
import { describe, it, expect } from 'vitest';
import { GateExecutor } from './gate-executor.js';

describe('GateExecutor', () => {
  it('passes gate when all checks succeed', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'quality',
      checks: [
        { type: 'command', command: 'echo "ok"' },
      ],
    });

    expect(result.passed).toBe(true);
  });

  it('fails gate when check fails', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'quality',
      checks: [
        { type: 'command', command: 'exit 1' },
      ],
    });

    expect(result.passed).toBe(false);
  });
});

describe('GateExecutor multiple checks', () => {
  it('runs all checks when all pass', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'multi',
      checks: [
        { type: 'command', command: 'echo "check1"' },
        { type: 'command', command: 'echo "check2"' },
        { type: 'command', command: 'echo "check3"' },
      ],
    });

    expect(result.passed).toBe(true);
  });

  it('stops at first failing check', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'multi',
      checks: [
        { type: 'command', command: 'echo "check1"' },
        { type: 'command', command: 'exit 1' },
        { type: 'command', command: 'echo "check3"' }, // Should not run
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failedCheck?.command).toBe('exit 1');
  });
});

describe('GateExecutor error handling', () => {
  it('includes error message on failure', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'error-test',
      checks: [
        { type: 'command', command: 'exit 42' },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns passed check details on failure', async () => {
    const failingCheck = { type: 'command' as const, command: 'false' };
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'fail-test',
      checks: [failingCheck],
    });

    expect(result.passed).toBe(false);
    expect(result.failedCheck).toEqual(failingCheck);
  });
});

describe('GateExecutor empty gates', () => {
  it('passes when no checks defined', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'empty',
      checks: [],
    });

    expect(result.passed).toBe(true);
  });
});
