// packages/tui/src/tabs/Overview.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Overview } from './Overview.js';
import type { WorkflowState } from '@hyh/daemon';

// Helper to create minimal workflow state for testing
function createWorkflowState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    workflowId: 'test-workflow',
    workflowName: 'Test Workflow',
    startedAt: Date.now(),
    currentPhase: 'implement',
    phaseHistory: [],
    tasks: {},
    agents: {},
    checkpoints: {},
    pendingHumanActions: [],
    ...overrides,
  };
}

describe('Overview Tab', () => {
  describe('when no state is provided', () => {
    it('should render a message indicating no workflow state', () => {
      const { lastFrame } = render(<Overview state={null} />);

      expect(lastFrame()).toContain('No workflow state');
    });
  });

  describe('when state is provided', () => {
    it('should render the current phase', () => {
      const state = createWorkflowState({ currentPhase: 'implement' });

      const { lastFrame } = render(<Overview state={state} />);

      expect(lastFrame()).toContain('implement');
    });

    it('should render phase progress and task summary', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        tasks: {
          'task-1': {
            id: 'task-1',
            description: 'Task 1',
            status: 'completed',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: Date.now(),
            attempts: 1,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-2': {
            id: 'task-2',
            description: 'Task 2',
            status: 'running',
            claimedBy: 'agent-1',
            claimedAt: Date.now(),
            startedAt: Date.now(),
            completedAt: null,
            attempts: 1,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-3': {
            id: 'task-3',
            description: 'Task 3',
            status: 'pending',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: null,
            attempts: 0,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
        },
      });

      const { lastFrame } = render(<Overview state={state} />);

      // Should show phase
      expect(lastFrame()).toContain('implement');
      // Should show progress (1/3 completed)
      expect(lastFrame()).toContain('1/3');
    });

    it('should display task counts by status', () => {
      const state = createWorkflowState({
        currentPhase: 'test',
        tasks: {
          'task-1': {
            id: 'task-1',
            description: 'Task 1',
            status: 'completed',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: Date.now(),
            attempts: 1,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-2': {
            id: 'task-2',
            description: 'Task 2',
            status: 'completed',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: Date.now(),
            attempts: 1,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-3': {
            id: 'task-3',
            description: 'Task 3',
            status: 'running',
            claimedBy: 'agent-1',
            claimedAt: Date.now(),
            startedAt: Date.now(),
            completedAt: null,
            attempts: 1,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-4': {
            id: 'task-4',
            description: 'Task 4',
            status: 'pending',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: null,
            attempts: 0,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
          'task-5': {
            id: 'task-5',
            description: 'Task 5',
            status: 'pending',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            completedAt: null,
            attempts: 0,
            lastError: null,
            dependencies: [],
            files: [],
            timeoutSeconds: 600,
          },
        },
      });

      const { lastFrame } = render(<Overview state={state} />);
      const output = lastFrame() || '';

      // Should show completed count (2)
      expect(output).toContain('Completed');
      expect(output).toContain('2');
      // Should show running count (1)
      expect(output).toContain('Running');
      expect(output).toContain('1');
      // Should show pending count (2)
      expect(output).toContain('Pending');
    });

    it('should handle empty tasks gracefully', () => {
      const state = createWorkflowState({
        currentPhase: 'init',
        tasks: {},
      });

      const { lastFrame } = render(<Overview state={state} />);
      const output = lastFrame() || '';

      // Should show phase
      expect(output).toContain('init');
      // Should show 0/0 progress
      expect(output).toContain('0/0');
    });

    it('should display active agents', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        agents: {
          'agent-1': {
            id: 'agent-1',
            type: 'worker',
            status: 'active',
            currentTask: 'task-1',
            pid: 1234,
            sessionId: 'session-1',
            lastHeartbeat: Date.now(),
            violationCounts: {},
          },
          'agent-2': {
            id: 'agent-2',
            type: 'worker',
            status: 'idle',
            currentTask: null,
            pid: 5678,
            sessionId: 'session-2',
            lastHeartbeat: Date.now(),
            violationCounts: {},
          },
          'agent-3': {
            id: 'agent-3',
            type: 'worker',
            status: 'stopped',
            currentTask: null,
            pid: null,
            sessionId: null,
            lastHeartbeat: null,
            violationCounts: {},
          },
        },
      });

      const { lastFrame } = render(<Overview state={state} />);
      const output = lastFrame() || '';

      // Should show agents section
      expect(output).toContain('Agents');
      // Should show active agent count or list
      expect(output).toContain('agent-1');
    });

    it('should display no agents message when none are active', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        agents: {},
      });

      const { lastFrame } = render(<Overview state={state} />);
      const output = lastFrame() || '';

      // Should indicate no active agents
      expect(output).toContain('No active agents');
    });
  });

  describe('Todo progress display', () => {
    it('should show todo completion percentage', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        todo: {
          total: 10,
          completed: 7,
          incomplete: ['item1', 'item2', 'item3'],
        },
      });

      const { lastFrame } = render(<Overview state={state} />);

      expect(lastFrame()).toContain('Todo: 7/10 (70%)');
    });

    it('should show incomplete items if any', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        todo: {
          total: 3,
          completed: 1,
          incomplete: ['Fix tests', 'Update docs'],
        },
      });

      const { lastFrame } = render(<Overview state={state} />);

      expect(lastFrame()).toContain('Fix tests');
      expect(lastFrame()).toContain('Update docs');
    });

    it('should not show todo section when no todo data', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
      });

      const { lastFrame } = render(<Overview state={state} />);

      expect(lastFrame()).not.toContain('Todo:');
    });

    it('should not show todo section when total is 0', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        todo: {
          total: 0,
          completed: 0,
          incomplete: [],
        },
      });

      const { lastFrame } = render(<Overview state={state} />);

      expect(lastFrame()).not.toContain('Todo:');
    });

    it('should limit displayed incomplete items to 5', () => {
      const state = createWorkflowState({
        currentPhase: 'implement',
        todo: {
          total: 10,
          completed: 2,
          incomplete: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7', 'Item 8'],
        },
      });

      const { lastFrame } = render(<Overview state={state} />);
      const output = lastFrame() || '';

      // First 5 should be shown
      expect(output).toContain('Item 1');
      expect(output).toContain('Item 5');
      // Should show "and X more" message
      expect(output).toContain('and 3 more');
    });
  });
});
