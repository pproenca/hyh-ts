// packages/cli/src/commands/heartbeat.test.ts
import { describe, it, expect } from 'vitest';

describe('heartbeat command', () => {
  it('exports registerHeartbeatCommand', async () => {
    const { registerHeartbeatCommand } = await import('./heartbeat.js');
    expect(registerHeartbeatCommand).toBeDefined();
  });
});
