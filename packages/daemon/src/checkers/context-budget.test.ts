// packages/daemon/src/checkers/context-budget.test.ts
import { describe, it, expect } from 'vitest';
import { ContextBudgetChecker, estimateTokens } from './context-budget.js';
import type { CheckContext } from './types.js';

describe('estimateTokens', () => {
  it('uses tiktoken for accurate token counting', () => {
    // With tiktoken cl100k_base, repeated 'a' compresses well
    // 400 'a' chars becomes ~50 tokens due to BPE encoding
    const text = 'a'.repeat(400);
    expect(estimateTokens(text)).toBe(50);
  });

  it('should estimate tokens more accurately than char/4', () => {
    // "antidisestablishmentarianism" is 28 chars -> char/4 = 7
    // But tiktoken cl100k_base encodes it as 5 tokens
    const text = 'antidisestablishmentarianism';
    const tokens = estimateTokens(text);

    // If using tiktoken: 5 tokens
    // If using char/4: ceil(28/4) = 7 tokens
    // This test will fail with char/4 (7 > 6)
    expect(tokens).toBeLessThanOrEqual(6);
  });

  it('should handle code snippets', () => {
    const code = `function hello() { console.log("world"); }`;
    const tokens = estimateTokens(code);

    // Code typically has more tokens per char than prose
    expect(tokens).toBeGreaterThan(5);
  });
});

describe('ContextBudgetChecker', () => {
  // Helper to create realistic varied text that doesn't compress as much
  const createVariedText = (length: number) => {
    const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'runs', 'away', 'from', 'danger'];
    let result = '';
    let i = 0;
    while (result.length < length) {
      result += words[i % words.length] + ' ';
      i++;
    }
    return result.slice(0, length);
  };

  it('returns violation when context exceeds 80% limit', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    // Use varied text that tokenizes more predictably
    // Each event with ~1600 chars of varied text should produce ~400+ tokens
    // 3 events * ~400 tokens = ~1200 tokens, well over 80% of 1000
    const trajectory = Array(3).fill(null).map(() => ({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: createVariedText(1600),
    }));

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

    // Use varied text: 2 events with ~1500 chars each should produce ~700-750 tokens
    // which is between 60% (600) and 80% (800) of 1000
    const trajectory = Array(2).fill(null).map(() => ({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: createVariedText(1500),
    }));

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

    // Small trajectory that stays under 60% of limit
    const trajectory = Array(2).fill(null).map(() => ({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: createVariedText(400),
    }));

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
