// packages/tui/src/tabs/Tasks.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Tasks } from './Tasks.js';

describe('Tasks Tab', () => {
  it('should render tasks grouped by status', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          description: 'Setup',
          status: 'completed' as const,
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
        'task-2': {
          id: 'task-2',
          description: 'Feature',
          status: 'running' as const,
          claimedBy: 'worker-1',
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        },
        'task-3': {
          id: 'task-3',
          description: 'Tests',
          status: 'pending' as const,
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
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    const { lastFrame } = render(<Tasks state={state} />);

    expect(lastFrame()).toContain('Setup');
    expect(lastFrame()).toContain('Feature');
    expect(lastFrame()).toContain('worker-1');
  });

  it('should display status icons correctly', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          description: 'Completed task',
          status: 'completed' as const,
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
        'task-2': {
          id: 'task-2',
          description: 'Running task',
          status: 'running' as const,
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
        'task-3': {
          id: 'task-3',
          description: 'Pending task',
          status: 'pending' as const,
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
        'task-4': {
          id: 'task-4',
          description: 'Failed task',
          status: 'failed' as const,
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
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    const { lastFrame } = render(<Tasks state={state} />);
    const output = lastFrame() || '';

    // Check status icons are present
    expect(output).toContain('✓'); // completed
    expect(output).toContain('●'); // running
    expect(output).toContain('○'); // pending
    expect(output).toContain('✗'); // failed
  });

  it('should show "No tasks" when state is null', () => {
    const { lastFrame } = render(<Tasks state={null} />);

    expect(lastFrame()).toContain('No tasks');
  });

  it('should display legend at bottom', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          description: 'Setup',
          status: 'pending' as const,
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
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    const { lastFrame } = render(<Tasks state={state} />);
    const output = lastFrame() || '';

    // Check legend is displayed
    expect(output).toContain('✓ completed');
    expect(output).toContain('● running');
    expect(output).toContain('○ pending');
    expect(output).toContain('✗ failed');
  });
});
