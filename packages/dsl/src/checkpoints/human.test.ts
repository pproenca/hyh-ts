// packages/dsl/src/checkpoints/human.test.ts
import { describe, it, expect } from 'vitest';
import { human } from './human.js';

describe('human.choose', () => {
  it('creates choice checkpoint with options', () => {
    const choice = human.choose(['Option A', 'Option B', 'Option C']);
    expect(choice.type).toBe('choice');
    expect(choice.options).toEqual(['Option A', 'Option B', 'Option C']);
    expect(choice.id).toBeDefined();
  });

  it('creates choice with single option', () => {
    const choice = human.choose(['Only option']);
    expect(choice.options).toHaveLength(1);
  });
});

describe('human.approval', () => {
  it('creates basic approval checkpoint', () => {
    const cp = human.approval();
    expect(cp.type).toBe('approval');
    expect(cp.id).toBeDefined();
  });

  it('creates approval with question', () => {
    const cp = human.approval('Ready to merge?');
    expect(cp.question).toBe('Ready to merge?');
  });

  it('creates approval with options', () => {
    const cp = human.approval({
      question: 'Proceed?',
      timeout: 300000,
      onTimeout: 'abort',
    });
    expect(cp.question).toBe('Proceed?');
    expect(cp.timeout).toBe(300000);
    expect(cp.onTimeout).toBe('abort');
  });
});
