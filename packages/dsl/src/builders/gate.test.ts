// packages/dsl/src/builders/gate.test.ts
import { describe, it, expect } from 'vitest';
import { gate, GateBuilder, CheckBuilder } from './gate.js';
import type { Context } from '../types/context.js';

describe('GateBuilder', () => {
  describe('gate()', () => {
    it('creates a GateBuilder with the given name', () => {
      const g = gate('code-review');
      expect(g).toBeInstanceOf(GateBuilder);
      expect(g.build().name).toBe('code-review');
    });
  });

  describe('requires() with per-check corrections', () => {
    it('adds a check with predicate string', () => {
      const g = gate('tests-pass').requires((ctx: Context) => ctx.phase === 'test');
      const built = g.build();
      expect(built.checks).toHaveLength(1);
      expect(built.checks[0]?.predicate).toContain('ctx.phase');
    });

    it('returns CheckBuilder for fluent correction chaining', () => {
      const checkBuilder = gate('tests-pass').requires((ctx: Context) => ctx.phase === 'test');
      expect(checkBuilder).toBeInstanceOf(CheckBuilder);
    });

    it('supports correction verbs on check', () => {
      const g = gate('tests-pass')
        .requires((ctx: Context) => ctx.phase === 'test')
        .retries({ max: 3 })
        .otherwise.escalates('human');
      const built = g.build();

      expect(built.checks[0]?.correction?.type).toBe('retry');
      expect(built.checks[0]?.correction?.max).toBe(3);
      expect(built.checks[0]?.correction?.then?.type).toBe('escalate');
    });

    it('supports multiple checks with different corrections', () => {
      const g = gate('all-checks')
        .requires((ctx: Context) => ctx.phase === 'test')
        .retries({ max: 3 })
        .otherwise.escalates('human')
        .requires((ctx: Context) => ctx.task !== null)
        .retries({ max: 1 })
        .otherwise.blocks('Task required');

      const built = g.build();
      expect(built.checks).toHaveLength(2);

      // First check
      expect(built.checks[0]?.correction?.type).toBe('retry');
      expect(built.checks[0]?.correction?.max).toBe(3);

      // Second check
      expect(built.checks[1]?.correction?.type).toBe('retry');
      expect(built.checks[1]?.correction?.max).toBe(1);
      expect(built.checks[1]?.correction?.then?.type).toBe('block');
    });

    it('supports async check functions', () => {
      const g = gate('async-check').requires(async (ctx: Context) => {
        return ctx.phase === 'verify';
      });
      const built = g.build();
      expect(built.checks[0]?.predicate).toContain('async');
    });
  });

  describe('build()', () => {
    it('returns CompiledGate with empty checks array', () => {
      const g = gate('simple');
      const built = g.build();
      expect(built).toEqual({
        name: 'simple',
        checks: [],
      });
    });

    it('returns complete CompiledGate with checks and corrections', () => {
      const g = gate('full-gate')
        .requires((ctx: Context) => ctx.phase === 'done')
        .retries({ max: 3 })
        .otherwise.blocks();

      const built = g.build();
      expect(built.name).toBe('full-gate');
      expect(built.checks).toHaveLength(1);
      expect(built.checks[0]?.correction?.type).toBe('retry');
    });
  });

  describe('fluent chaining', () => {
    it('supports full fluent API chain with per-check corrections', () => {
      const g = gate('fluent-gate')
        .requires((ctx: Context) => Boolean(ctx.task))
        .prompts('Task required')
        .requires((ctx: Context) => ctx.phase === 'verify')
        .retries({ max: 2 })
        .otherwise.escalates('human');

      const built = g.build();
      expect(built.name).toBe('fluent-gate');
      expect(built.checks).toHaveLength(2);

      // First check: prompt correction
      expect(built.checks[0]?.correction?.type).toBe('prompt');
      expect(built.checks[0]?.correction?.message).toBe('Task required');

      // Second check: retry then escalate
      expect(built.checks[1]?.correction?.type).toBe('retry');
      expect(built.checks[1]?.correction?.then?.to).toBe('human');
    });
  });
});
