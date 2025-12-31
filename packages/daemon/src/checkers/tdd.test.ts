// packages/daemon/src/checkers/tdd.test.ts
import { describe, it, expect } from 'vitest';
import { TddChecker } from './tdd.js';
import type { TrajectoryEvent } from './types.js';

describe('TddChecker', () => {
  const checker = new TddChecker({
    test: '**/*.test.ts',
    impl: 'src/**/*.ts',
    agentName: 'worker',
  });

  it('allows test file writes', () => {
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.test.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
      trajectory: [],
    });

    expect(result).toBeNull();
  });

  it('blocks impl write before test', () => {
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
      trajectory: [], // No prior test write
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('tdd');
  });

  it('allows impl after test write', () => {
    const testEvent: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now() - 1000,
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.test.ts',
    };

    const implEvent: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(implEvent, {
      agentId: 'worker-1',
      event: implEvent,
      state: {},
      trajectory: [testEvent],
    });

    expect(result).toBeNull();
  });

  describe('appliesTo', () => {
    it('applies to agents starting with configured agentName', () => {
      expect(checker.appliesTo('worker-1', {})).toBe(true);
      expect(checker.appliesTo('worker-abc', {})).toBe(true);
    });

    it('does not apply to agents not starting with configured agentName', () => {
      expect(checker.appliesTo('orchestrator-1', {})).toBe(false);
      expect(checker.appliesTo('other', {})).toBe(false);
    });
  });

  describe('non-write events', () => {
    it('ignores non-tool_use events', () => {
      const event: TrajectoryEvent = {
        type: 'message',
        timestamp: Date.now(),
        agentId: 'worker-1',
        content: 'Some message',
      };

      const result = checker.check(event, {
        agentId: 'worker-1',
        event,
        state: {},
        trajectory: [],
      });

      expect(result).toBeNull();
    });

    it('ignores non-Write/Edit tools', () => {
      const event: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: 'Read',
        path: 'src/auth/token.ts',
      };

      const result = checker.check(event, {
        agentId: 'worker-1',
        event,
        state: {},
        trajectory: [],
      });

      expect(result).toBeNull();
    });
  });

  describe('Edit tool', () => {
    it('blocks impl edit before test', () => {
      const event: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: 'Edit',
        path: 'src/auth/token.ts',
      };

      const result = checker.check(event, {
        agentId: 'worker-1',
        event,
        state: {},
        trajectory: [],
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('tdd');
    });

    it('allows impl edit after test write', () => {
      const testEvent: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now() - 1000,
        agentId: 'worker-1',
        tool: 'Write',
        path: 'src/auth/token.test.ts',
      };

      const implEvent: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: 'Edit',
        path: 'src/auth/token.ts',
      };

      const result = checker.check(implEvent, {
        agentId: 'worker-1',
        event: implEvent,
        state: {},
        trajectory: [testEvent],
      });

      expect(result).toBeNull();
    });
  });

  describe('violation correction', () => {
    it('returns correction with guidance message', () => {
      const event: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: 'Write',
        path: 'src/auth/token.ts',
      };

      const result = checker.check(event, {
        agentId: 'worker-1',
        event,
        state: {},
        trajectory: [],
      });

      expect(result).not.toBeNull();
      expect(result!.correction).toBeDefined();
      expect(result!.correction!.type).toBe('prompt');
      expect(result!.correction!.message).toContain('test');
    });

    it('includes file path in violation message', () => {
      const event: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: 'Write',
        path: 'src/auth/token.ts',
      };

      const result = checker.check(event, {
        agentId: 'worker-1',
        event,
        state: {},
        trajectory: [],
      });

      expect(result!.message).toContain('src/auth/token.ts');
    });
  });
});
