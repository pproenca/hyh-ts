// packages/daemon/src/checkers/phase-tool.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseToolChecker } from './phase-tool.js';
import type { CheckContext, TrajectoryEvent } from './types.js';
import type { CompiledPhase } from '@hyh/dsl';

describe('PhaseToolChecker', () => {
  const phase: CompiledPhase = {
    name: 'explore',
    agent: 'orchestrator',
    expects: ['Read', 'Grep', 'Glob'],
    forbids: ['Write', 'Edit'],
    outputs: [],
    requires: [],
    parallel: false,
  };

  it('returns violation for forbidden tool', () => {
    const checker = new PhaseToolChecker(phase);
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'orchestrator',
      tool: 'Write',
      path: 'file.ts',
    };
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event,
      trajectory: [],
      state: { currentPhase: 'explore' },
    };

    const violation = checker.check(event, ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('forbidden_tool');
    expect(violation?.message).toContain('Write');
    expect(violation?.correction?.type).toBe('block');
  });

  it('returns warning for unexpected tool', () => {
    const checker = new PhaseToolChecker(phase);
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'orchestrator',
      tool: 'Bash',
      command: 'ls',
    };
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event,
      trajectory: [],
      state: { currentPhase: 'explore' },
    };

    const violation = checker.check(event, ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('unexpected_tool');
    expect(violation?.correction?.type).toBe('warn');
  });

  it('returns null for expected tool', () => {
    const checker = new PhaseToolChecker(phase);
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'orchestrator',
      tool: 'Read',
      path: 'file.ts',
    };
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event,
      trajectory: [],
      state: { currentPhase: 'explore' },
    };

    const violation = checker.check(event, ctx);
    expect(violation).toBeNull();
  });

  describe('appliesTo', () => {
    it('applies to agents matching the phase agent', () => {
      const checker = new PhaseToolChecker(phase);
      expect(checker.appliesTo('orchestrator', {})).toBe(true);
      expect(checker.appliesTo('orchestrator-1', {})).toBe(true);
    });

    it('does not apply to agents not matching the phase agent', () => {
      const checker = new PhaseToolChecker(phase);
      expect(checker.appliesTo('worker-1', {})).toBe(false);
      expect(checker.appliesTo('other', {})).toBe(false);
    });
  });

  describe('non-tool_use events', () => {
    it('ignores non-tool_use events', () => {
      const checker = new PhaseToolChecker(phase);
      const event: TrajectoryEvent = {
        type: 'message',
        timestamp: Date.now(),
        agentId: 'orchestrator',
        content: 'Some message',
      };
      const ctx: CheckContext = {
        agentId: 'orchestrator',
        event,
        trajectory: [],
        state: { currentPhase: 'explore' },
      };

      const violation = checker.check(event, ctx);
      expect(violation).toBeNull();
    });
  });

  describe('empty expects array', () => {
    it('allows any non-forbidden tool when expects is empty', () => {
      const phaseNoExpects: CompiledPhase = {
        name: 'free',
        agent: 'orchestrator',
        expects: [],
        forbids: ['Write'],
        outputs: [],
        requires: [],
        parallel: false,
      };
      const checker = new PhaseToolChecker(phaseNoExpects);
      const event: TrajectoryEvent = {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'orchestrator',
        tool: 'Bash',
        command: 'ls',
      };
      const ctx: CheckContext = {
        agentId: 'orchestrator',
        event,
        trajectory: [],
        state: { currentPhase: 'free' },
      };

      const violation = checker.check(event, ctx);
      expect(violation).toBeNull();
    });
  });
});
