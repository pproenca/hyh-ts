// packages/daemon/src/checkers/context-budget.test.ts
import { describe, it, expect } from 'vitest';
import { ContextBudgetChecker, estimateTokens } from './context-budget.js';
import type { CheckContext } from './types.js';

describe('estimateTokens', () => {
  it('estimates ~1 token per 4 characters', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});

describe('ContextBudgetChecker', () => {
  it('returns violation when context exceeds 80% limit', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    const trajectory = Array(10).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(340),
    });

    const event = { type: 'message' as const, timestamp: Date.now(), agentId: 'worker', content: 'test' };
    const ctx: CheckContext = {
      agentId: 'worker',
      event,
      trajectory,
      state: {} as unknown,
    };

    const violation = checker.check(ctx.event, ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('context_exceeded');
    expect(violation?.correction?.type).toBe('prompt');
  });

  it('returns warning when context exceeds warn threshold', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    // ~180 chars data + 73 chars JSON overhead = ~253 chars per event
    // 10 events * 253 chars / 4 = ~633 tokens = 63.3% (between warn 60% and max 80%)
    const trajectory = Array(10).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(180),
    });

    const event = { type: 'message' as const, timestamp: Date.now(), agentId: 'worker', content: 'test' };
    const ctx: CheckContext = {
      agentId: 'worker',
      event,
      trajectory,
      state: {} as unknown,
    };

    const violation = checker.check(ctx.event, ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('context_warning');
    expect(violation?.correction?.type).toBe('warn');
  });

  it('returns null when context is within limits', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    const trajectory = Array(5).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(200),
    });

    const event = { type: 'message' as const, timestamp: Date.now(), agentId: 'worker', content: 'test' };
    const ctx: CheckContext = {
      agentId: 'worker',
      event,
      trajectory,
      state: {} as unknown,
    };

    const violation = checker.check(ctx.event, ctx);
    expect(violation).toBeNull();
  });

  it('applies to all agents by default', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      modelLimit: 1000,
    });

    expect(checker.appliesTo('worker', {})).toBe(true);
    expect(checker.appliesTo('orchestrator', {})).toBe(true);
  });
});
