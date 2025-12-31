// packages/daemon/src/types/state.test.ts
import { describe, it, expect } from 'vitest';
import {
  TaskStateSchema,
  WorkflowStateSchema,
  WorkflowState,
  AgentStateSchema,
  PhaseTransitionSchema,
  ClaimResultSchema,
} from './state.js';

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

  it('should support recentLogs field', () => {
    const state: WorkflowState = {
      workflowId: 'test',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'plan',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
      recentLogs: [
        { timestamp: Date.now(), agentId: 'worker-1', message: 'test' },
      ],
    };
    expect(state.recentLogs).toHaveLength(1);
  });
});

describe('TaskState status enum', () => {
  it('validates pending status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'pending',
    });
    expect(result.success).toBe(true);
  });

  it('validates claimed status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'claimed',
      claimedBy: 'worker-1',
      claimedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates running status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'running',
      startedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates verifying status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'verifying',
    });
    expect(result.success).toBe(true);
  });

  it('validates completed status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'completed',
      completedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates failed status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'failed',
      lastError: 'Something went wrong',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Test',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentState', () => {
  it('validates agent with required fields', () => {
    const result = AgentStateSchema.safeParse({
      id: 'agent-1',
      type: 'worker',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('validates agent with all fields', () => {
    const result = AgentStateSchema.safeParse({
      id: 'agent-1',
      type: 'worker',
      status: 'active',
      currentTask: 'T001',
      pid: 12345,
      sessionId: 'session-abc',
      lastHeartbeat: Date.now(),
      violationCounts: { tdd: 2, fileScope: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('validates all agent statuses', () => {
    const statuses = ['idle', 'active', 'stopped'];
    for (const status of statuses) {
      const result = AgentStateSchema.safeParse({
        id: 'agent-1',
        type: 'worker',
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('PhaseTransition', () => {
  it('validates phase transition', () => {
    const result = PhaseTransitionSchema.safeParse({
      from: 'plan',
      to: 'implement',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });
});

describe('ClaimResult', () => {
  it('validates claim result with task', () => {
    const result = ClaimResultSchema.safeParse({
      task: {
        id: 'T001',
        description: 'Test',
        status: 'running',
      },
      isRetry: false,
      isReclaim: false,
    });
    expect(result.success).toBe(true);
  });

  it('validates claim result without task', () => {
    const result = ClaimResultSchema.safeParse({
      task: null,
    });
    expect(result.success).toBe(true);
  });
});
