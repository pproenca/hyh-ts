// packages/daemon/src/types/state.test.ts
import { describe, it, expect } from 'vitest';
import { TaskStateSchema, WorkflowStateSchema, TaskStatus } from './state.js';

describe('TaskState', () => {
  it('validates valid task state', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Setup project',
      status: 'pending',
      dependencies: ['T000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty task id', () => {
    const result = TaskStateSchema.safeParse({
      id: '',
      description: 'Setup project',
      status: 'pending',
    });
    expect(result.success).toBe(false);
  });
});

describe('WorkflowState', () => {
  it('validates workflow with tasks', () => {
    const result = WorkflowStateSchema.safeParse({
      workflowId: 'wf-123',
      workflowName: 'feature',
      startedAt: Date.now(),
      currentPhase: 'implement',
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: 'completed',
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
