// packages/daemon/src/core/ipc-handlers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { registerIPCHandlers } from './ipc-handlers.js';

describe('registerIPCHandlers', () => {
  it('registers ping handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: {} as any,
      trajectory: { tail: vi.fn() } as any,
      agentLifecycle: { getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('ping', expect.any(Function));
  });

  it('registers get_state handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: { load: vi.fn() } as any,
      trajectory: { tail: vi.fn() } as any,
      agentLifecycle: { getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('get_state', expect.any(Function));
  });

  it('registers get_logs handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: {} as any,
      trajectory: { tail: vi.fn(), filterByAgent: vi.fn() } as any,
      agentLifecycle: { getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('get_logs', expect.any(Function));
  });

  it('registers heartbeat handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: {} as any,
      trajectory: { tail: vi.fn() } as any,
      agentLifecycle: { recordHeartbeat: vi.fn(), getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('heartbeat', expect.any(Function));
  });

  it('registers status handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: { load: vi.fn() } as any,
      trajectory: { tail: vi.fn() } as any,
      agentLifecycle: { getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('status', expect.any(Function));
  });

  it('registers shutdown handler', async () => {
    const mockServer = { registerHandler: vi.fn() };

    registerIPCHandlers(mockServer as any, {
      stateManager: {} as any,
      trajectory: { tail: vi.fn() } as any,
      agentLifecycle: { getActiveAgents: vi.fn().mockReturnValue([]) } as any,
      stopCallback: vi.fn(),
    });

    expect(mockServer.registerHandler).toHaveBeenCalledWith('shutdown', expect.any(Function));
  });
});
