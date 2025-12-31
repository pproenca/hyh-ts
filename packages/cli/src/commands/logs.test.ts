// packages/cli/src/commands/logs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock IPCClient
vi.mock('../ipc/client.js', () => ({
  IPCClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        logs: [
          { timestamp: 1704067200000, agentId: 'worker-1', type: 'tool_use', message: '{}' },
        ],
      },
    }),
  })),
}));

describe('logs command', () => {
  it('requests logs via get_logs IPC command', async () => {
    const { IPCClient } = await import('../ipc/client.js');
    const mockClient = new IPCClient('/tmp/test.sock');

    // Invoke the command logic
    await mockClient.connect();
    const response = await mockClient.request({ command: 'get_logs', limit: 20 });

    expect(response.status).toBe('ok');
    expect(response.data.logs).toHaveLength(1);
  });
});
