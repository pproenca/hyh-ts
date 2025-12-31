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
