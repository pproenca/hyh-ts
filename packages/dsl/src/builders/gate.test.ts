// packages/dsl/src/builders/gate.test.ts
import { describe, it, expect } from 'vitest';
import { gate, GateBuilder } from './gate.js';
import { correct } from '../corrections/index.js';
import { Context } from '../types/context.js';

describe('GateBuilder', () => {
  describe('gate()', () => {
    it('creates a GateBuilder with the given name', () => {
      const g = gate('code-review');
      expect(g).toBeInstanceOf(GateBuilder);
      expect(g.build().name).toBe('code-review');
    });
  });

  describe('requires()', () => {
    it('adds a check function as string representation', () => {
      const g = gate('tests-pass').requires((ctx: Context) => ctx.phase === 'test');
      const built = g.build();
      expect(built.requires).toHaveLength(1);
      expect(built.requires[0]).toContain('ctx.phase');
    });

    it('supports multiple requires calls', () => {
      const g = gate('all-checks')
        .requires((ctx: Context) => ctx.phase === 'test')
        .requires((ctx: Context) => ctx.task !== null);
      const built = g.build();
      expect(built.requires).toHaveLength(2);
    });

    it('supports async check functions', () => {
      const g = gate('async-check').requires(async (ctx: Context) => {
        return ctx.phase === 'verify';
      });
      const built = g.build();
      expect(built.requires[0]).toContain('async');
    });
  });

  describe('onFail()', () => {
    it('sets correction to apply on gate failure', () => {
      const g = gate('code-review').onFail(correct.prompt('Review needed.'));
      const built = g.build();
      expect(built.onFail).toBeDefined();
      expect(built.onFail?.type).toBe('prompt');
      expect(built.onFail?.message).toBe('Review needed.');
    });

    it('supports different correction types', () => {
      const g = gate('escalate-gate').onFail(correct.escalate('human'));
      const built = g.build();
      expect(built.onFail?.type).toBe('escalate');
      expect(built.onFail?.to).toBe('human');
    });
  });

  describe('onFailFinal()', () => {
    it('sets final correction after all retries exhausted', () => {
      const g = gate('must-pass').onFailFinal(correct.block('Gate blocked.'));
      const built = g.build();
      expect(built.onFailFinal).toBeDefined();
      expect(built.onFailFinal?.type).toBe('block');
    });

    it('can be combined with onFail', () => {
      const g = gate('gradual-escalation')
        .onFail(correct.prompt('Try again.'))
        .onFailFinal(correct.escalate('orchestrator'));
      const built = g.build();
      expect(built.onFail?.type).toBe('prompt');
      expect(built.onFailFinal?.type).toBe('escalate');
    });
  });

  describe('build()', () => {
    it('returns CompiledGate with only defined fields', () => {
      const g = gate('simple');
      const built = g.build();
      expect(built).toEqual({
        name: 'simple',
        requires: [],
      });
      expect(built.onFail).toBeUndefined();
      expect(built.onFailFinal).toBeUndefined();
    });

    it('returns complete CompiledGate when all options set', () => {
      const g = gate('full-gate')
        .requires((ctx: Context) => ctx.phase === 'done')
        .onFail(correct.retry({ max: 3 }))
        .onFailFinal(correct.block());
      const built = g.build();
      expect(built.name).toBe('full-gate');
      expect(built.requires).toHaveLength(1);
      expect(built.onFail?.type).toBe('retry');
      expect(built.onFailFinal?.type).toBe('block');
    });
  });

  describe('fluent chaining', () => {
    it('supports full fluent API chain', () => {
      const g = gate('fluent-gate')
        .requires((ctx: Context) => Boolean(ctx.task))
        .requires((ctx: Context) => ctx.phase === 'verify')
        .onFail(correct.prompt('Check failed'))
        .onFailFinal(correct.escalate('human'));

      const built = g.build();
      expect(built.name).toBe('fluent-gate');
      expect(built.requires).toHaveLength(2);
      expect(built.onFail?.message).toBe('Check failed');
      expect(built.onFailFinal?.to).toBe('human');
    });
  });
});
