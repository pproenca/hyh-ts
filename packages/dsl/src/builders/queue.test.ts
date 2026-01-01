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

describe('QueueBuilder.done', () => {
  it('sets done predicate for completion detection', () => {
    const q = queue('tasks').done((task) => task.status === 'completed');
    const built = q.build();
    expect(built.donePredicate).toBeDefined();
    expect(built.donePredicate).toContain('task.status');
    expect(built.donePredicate).toContain('completed');
  });
});

describe('QueueBuilder.examples', () => {
  it('sets example tasks for simulation mode', () => {
    const q = queue('tasks').examples(
      { title: 'Implement auth', description: 'Add JWT auth' },
      { title: 'Add tests', description: 'Write unit tests' }
    );
    const built = q.build();
    expect(built.examples).toHaveLength(2);
    expect(built.examples![0]?.title).toBe('Implement auth');
  });

  it('supports empty examples', () => {
    const q = queue('tasks').examples();
    const built = q.build();
    expect(built.examples).toEqual([]);
  });
});

describe('QueueBuilder fluent API', () => {
  it('supports full fluent chain', () => {
    const q = queue('implementation-tasks')
      .ready((task) => task.deps.allComplete)
      .done((task) => task.status === 'verified')
      .timeout('30m')
      .examples(
        { title: 'Task 1', description: 'Description 1' }
      );

    const built = q.build();
    expect(built.name).toBe('implementation-tasks');
    expect(built.readyPredicate).toContain('task.deps.allComplete');
    expect(built.donePredicate).toContain('verified');
    expect(built.timeout).toBe(1800000);
    expect(built.examples).toHaveLength(1);
  });
});
