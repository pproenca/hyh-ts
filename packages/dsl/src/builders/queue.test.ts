// packages/dsl/src/builders/queue.test.ts
import { describe, it, expect } from 'vitest';
import { queue } from './queue.js';

describe('QueueBuilder', () => {
  it('creates queue with name', () => {
    const q = queue('tasks');
    expect(q.build().name).toBe('tasks');
  });

  it('sets ready predicate', () => {
    const q = queue('tasks').ready((task) => task.deps.allComplete);
    expect(q.build().readyPredicate).toBe('task.deps.allComplete');
  });

  it('sets timeout', () => {
    const q = queue('tasks').timeout('10m');
    expect(q.build().timeout).toBe(600000);
  });
});
