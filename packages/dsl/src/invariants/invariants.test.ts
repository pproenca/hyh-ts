// packages/dsl/src/invariants/invariants.test.ts
import { describe, it, expect } from 'vitest';
import { inv } from './index.js';

describe('inv.tdd', () => {
  it('creates TDD invariant', () => {
    const invariant = inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    });

    expect(invariant.type).toBe('tdd');
    expect(invariant.options).toEqual({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    });
  });

  it('uses default order when not specified', () => {
    const invariant = inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
    });

    expect(invariant.options?.order).toEqual(['test', 'impl']);
  });

  it('supports commit option', () => {
    const invariant = inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      commit: ['test', 'impl'],
    });

    expect(invariant.options?.commit).toEqual(['test', 'impl']);
  });
});

describe('inv.fileScope', () => {
  it('creates fileScope invariant', () => {
    const invariant = inv.fileScope((ctx) => ctx.task!.files);
    expect(invariant.type).toBe('fileScope');
  });

  it('stores getter as string', () => {
    const getter = (ctx: { task: { files: string[] } | null }) => ctx.task!.files;
    const invariant = inv.fileScope(getter);
    expect(invariant.options?.getter).toBe(getter.toString());
  });
});

describe('inv.noCode', () => {
  it('creates noCode invariant', () => {
    const invariant = inv.noCode();
    expect(invariant.type).toBe('noCode');
  });
});

describe('inv.readOnly', () => {
  it('creates readOnly invariant', () => {
    const invariant = inv.readOnly();
    expect(invariant.type).toBe('readOnly');
  });
});

describe('inv.mustReport', () => {
  it('creates mustReport invariant with format', () => {
    const invariant = inv.mustReport('markdown');
    expect(invariant.type).toBe('mustReport');
    expect(invariant.options).toEqual({ format: 'markdown' });
  });
});

describe('inv.mustProgress', () => {
  it('creates mustProgress invariant with duration string', () => {
    const invariant = inv.mustProgress('10m');
    expect(invariant.type).toBe('mustProgress');
    expect(invariant.options?.timeout).toBe(600000); // 10 minutes in ms
  });

  it('creates mustProgress invariant with number', () => {
    const invariant = inv.mustProgress(30000);
    expect(invariant.type).toBe('mustProgress');
    expect(invariant.options?.timeout).toBe(30000);
  });
});

describe('inv.externalTodo', () => {
  it('creates externalTodo invariant', () => {
    const invariant = inv.externalTodo({
      file: 'TODO.md',
      checkBeforeStop: true,
    });
    expect(invariant.type).toBe('externalTodo');
    expect(invariant.options).toEqual({
      file: 'TODO.md',
      checkBeforeStop: true,
    });
  });
});

describe('inv.contextLimit', () => {
  it('creates contextLimit invariant', () => {
    const invariant = inv.contextLimit({
      max: 100000,
      warn: 80000,
    });
    expect(invariant.type).toBe('contextLimit');
    expect(invariant.options).toEqual({
      max: 100000,
      warn: 80000,
    });
  });

  it('works without warn option', () => {
    const invariant = inv.contextLimit({ max: 50000 });
    expect(invariant.options).toEqual({ max: 50000 });
  });
});
