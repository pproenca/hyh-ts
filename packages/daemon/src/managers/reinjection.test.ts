// packages/daemon/src/managers/reinjection.test.ts
import { describe, it, expect } from 'vitest';
import { ReinjectionManager } from './reinjection.js';
import type { ReinjectionContext, ReinjectionOptions } from './reinjection.js';

describe('ReinjectionManager', () => {
  it('returns null until threshold reached', () => {
    const options: ReinjectionOptions = {
      every: 5,
      template: (ctx: ReinjectionContext) => `Reminder: ${ctx.objective}`,
    };
    const manager = new ReinjectionManager(options);

    // Tool uses 1-4 should return null
    expect(manager.onToolUse('agent-1', { objective: 'Complete task' })).toBeNull();
    expect(manager.onToolUse('agent-1', { objective: 'Complete task' })).toBeNull();
    expect(manager.onToolUse('agent-1', { objective: 'Complete task' })).toBeNull();
    expect(manager.onToolUse('agent-1', { objective: 'Complete task' })).toBeNull();
  });

  it('returns reinjection message at threshold', () => {
    const options: ReinjectionOptions = {
      every: 3,
      template: (ctx: ReinjectionContext) => `Reminder: ${ctx.objective}`,
    };
    const manager = new ReinjectionManager(options);

    // Tool uses 1-2 return null
    manager.onToolUse('agent-1', { objective: 'Complete task' });
    manager.onToolUse('agent-1', { objective: 'Complete task' });

    // Tool use 3 (threshold) returns message
    const result = manager.onToolUse('agent-1', { objective: 'Complete task' });
    expect(result).toBe('Reminder: Complete task');
  });

  it('tracks agents independently', () => {
    const options: ReinjectionOptions = {
      every: 2,
      template: (ctx: ReinjectionContext) => `Reminder: ${ctx.objective}`,
    };
    const manager = new ReinjectionManager(options);

    // Agent-1: first tool use
    expect(manager.onToolUse('agent-1', { objective: 'Task A' })).toBeNull();

    // Agent-2: first tool use
    expect(manager.onToolUse('agent-2', { objective: 'Task B' })).toBeNull();

    // Agent-1: second tool use (threshold) - should trigger
    expect(manager.onToolUse('agent-1', { objective: 'Task A' })).toBe('Reminder: Task A');

    // Agent-2: second tool use (threshold) - should trigger independently
    expect(manager.onToolUse('agent-2', { objective: 'Task B' })).toBe('Reminder: Task B');
  });

  it('resets count after reinjection', () => {
    const options: ReinjectionOptions = {
      every: 2,
      template: (ctx: ReinjectionContext) => `Reminder: ${ctx.objective}`,
    };
    const manager = new ReinjectionManager(options);

    // First cycle: 1, 2 (trigger)
    manager.onToolUse('agent-1', { objective: 'Task' });
    expect(manager.onToolUse('agent-1', { objective: 'Task' })).toBe('Reminder: Task');

    // Second cycle: 3, 4 (trigger again)
    expect(manager.onToolUse('agent-1', { objective: 'Task' })).toBeNull();
    expect(manager.onToolUse('agent-1', { objective: 'Task' })).toBe('Reminder: Task');
  });

  it('provides getCount method', () => {
    const options: ReinjectionOptions = {
      every: 5,
      template: (_ctx: ReinjectionContext) => `Reminder`,
    };
    const manager = new ReinjectionManager(options);

    expect(manager.getCount('agent-1')).toBe(0);

    manager.onToolUse('agent-1', { objective: 'Task' });
    expect(manager.getCount('agent-1')).toBe(1);

    manager.onToolUse('agent-1', { objective: 'Task' });
    expect(manager.getCount('agent-1')).toBe(2);
  });

  it('provides reset method', () => {
    const options: ReinjectionOptions = {
      every: 5,
      template: (_ctx: ReinjectionContext) => `Reminder`,
    };
    const manager = new ReinjectionManager(options);

    manager.onToolUse('agent-1', { objective: 'Task' });
    manager.onToolUse('agent-1', { objective: 'Task' });
    expect(manager.getCount('agent-1')).toBe(2);

    manager.reset('agent-1');
    expect(manager.getCount('agent-1')).toBe(0);
  });

  it('passes context with todoIncomplete to template', () => {
    const options: ReinjectionOptions = {
      every: 1,
      template: (ctx: ReinjectionContext) =>
        `Objective: ${ctx.objective}, Incomplete: ${ctx.todoIncomplete?.join(', ')}`,
    };
    const manager = new ReinjectionManager(options);

    const result = manager.onToolUse('agent-1', {
      objective: 'Build feature',
      todoIncomplete: ['Step 1', 'Step 2'],
    });

    expect(result).toBe('Objective: Build feature, Incomplete: Step 1, Step 2');
  });

  it('supports extensible context properties', () => {
    const options: ReinjectionOptions = {
      every: 1,
      template: (ctx: ReinjectionContext) => `Custom: ${ctx.customField}`,
    };
    const manager = new ReinjectionManager(options);

    const result = manager.onToolUse('agent-1', {
      objective: 'Task',
      customField: 'custom-value',
    });

    expect(result).toBe('Custom: custom-value');
  });
});
