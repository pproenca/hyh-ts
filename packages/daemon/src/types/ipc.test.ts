// packages/daemon/src/types/ipc.test.ts
import { describe, it, expect } from 'vitest';
import { GetLogsRequestSchema, IPCRequestSchema } from './ipc.js';

describe('GetLogsRequestSchema', () => {
  it('validates get_logs command with defaults', () => {
    const result = GetLogsRequestSchema.safeParse({ command: 'get_logs' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.agentId).toBeUndefined();
    }
  });

  it('validates get_logs with custom limit and agentId', () => {
    const result = GetLogsRequestSchema.safeParse({
      command: 'get_logs',
      limit: 50,
      agentId: 'worker-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.agentId).toBe('worker-1');
    }
  });

  it('is included in IPCRequestSchema union', () => {
    const result = IPCRequestSchema.safeParse({ command: 'get_logs', limit: 10 });
    expect(result.success).toBe(true);
  });
});
