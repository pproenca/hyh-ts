// packages/daemon/src/core/event-processor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventProcessor, type EventProcessorDeps } from './event-processor.js';

// Helper to create typed mock deps
function createMockDeps(overrides: Partial<{
  trajectory: Partial<EventProcessorDeps['trajectory']>;
  stateManager: Partial<EventProcessorDeps['stateManager']>;
  checkerChain: Partial<NonNullable<EventProcessorDeps['checkerChain']>> | null;
  correctionApplicator: Partial<NonNullable<EventProcessorDeps['correctionApplicator']>> | null;
}>): EventProcessorDeps {
  return {
    trajectory: { log: vi.fn().mockResolvedValue(undefined), ...overrides.trajectory },
    stateManager: { load: vi.fn().mockResolvedValue({}), ...overrides.stateManager },
    checkerChain: overrides.checkerChain ?? null,
    correctionApplicator: overrides.correctionApplicator ?? null,
  } as EventProcessorDeps;
}

describe('EventProcessor', () => {
  it('logs events to trajectory', async () => {
    const mockLog = vi.fn().mockResolvedValue(undefined);
    const processor = new EventProcessor(createMockDeps({
      trajectory: { log: mockLog },
    }));

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
    const processor = new EventProcessor(createMockDeps({
      checkerChain: { check: mockCheck },
    }));

    await processor.process('agent-1', {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'agent-1',
    });

    expect(mockCheck).toHaveBeenCalled();
  });

  it('applies correction when violation detected', async () => {
    const mockApply = vi.fn().mockResolvedValue({ applied: true });
    const processor = new EventProcessor(createMockDeps({
      checkerChain: {
        check: vi.fn().mockReturnValue({
          message: 'Violation',
          correction: { type: 'warn', message: 'Stop' },
        }),
      },
      correctionApplicator: { apply: mockApply },
    }));

    const result = await processor.process('agent-1', {
      type: 'tool_use',
      timestamp: Date.now(),
    });

    expect(mockApply).toHaveBeenCalled();
    expect(result.violation).toBeDefined();
  });
});
