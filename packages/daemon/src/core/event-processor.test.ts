// packages/daemon/src/core/event-processor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventProcessor } from './event-processor.js';

describe('EventProcessor', () => {
  it('logs events to trajectory', async () => {
    const mockLog = vi.fn().mockResolvedValue(undefined);
    const processor = new EventProcessor({
      trajectory: { log: mockLog } as any,
      stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
      checkerChain: null,
      correctionApplicator: null,
    });

    await processor.process('agent-1', {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'agent-1',
      toolName: 'Read',
    });

    expect(mockLog).toHaveBeenCalledOnce();
  });

  it('checks invariants when checker chain provided', async () => {
    const mockCheck = vi.fn().mockReturnValue(null);
    const processor = new EventProcessor({
      trajectory: { log: vi.fn() } as any,
      stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
      checkerChain: { check: mockCheck } as any,
      correctionApplicator: null,
    });

    await processor.process('agent-1', {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'agent-1',
    });

    expect(mockCheck).toHaveBeenCalled();
  });

  it('applies correction when violation detected', async () => {
    const mockApply = vi.fn().mockResolvedValue({ applied: true });
    const processor = new EventProcessor({
      trajectory: { log: vi.fn() } as any,
      stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
      checkerChain: {
        check: vi.fn().mockReturnValue({
          message: 'Violation',
          correction: { type: 'warn', message: 'Stop' },
        }),
      } as any,
      correctionApplicator: { apply: mockApply } as any,
    });

    const result = await processor.process('agent-1', {
      type: 'tool_use',
      timestamp: Date.now(),
    });

    expect(mockApply).toHaveBeenCalled();
    expect(result.violation).toBeDefined();
  });
});
