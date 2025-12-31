// packages/tui/src/tabs/Logs.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Logs } from './Logs.js';
import type { WorkflowState } from '@hyh/daemon';

describe('Logs tab', () => {
  const mockState: WorkflowState = {
    workflowId: 'test',
    workflowName: 'test-workflow',
    startedAt: Date.now(),
    currentPhase: 'implement',
    phaseHistory: [],
    tasks: {},
    agents: {
      'worker-1': {
        id: 'worker-1',
        type: 'worker',
        status: 'active',
        currentTask: 'T001',
        pid: 1234,
        sessionId: 'session-1',
        lastHeartbeat: Date.now(),
        violationCounts: {},
      },
    },
    checkpoints: {},
    pendingHumanActions: [],
  };

  // Extended state with recentLogs for testing
  const mockStateWithLogs = {
    ...mockState,
    recentLogs: [
      { timestamp: Date.now(), agentId: 'worker-1', message: 'Task started' },
      { timestamp: Date.now(), agentId: 'worker-1', message: 'Writing file' },
    ],
  };

  it('should render logs header', () => {
    const { lastFrame } = render(<Logs state={mockStateWithLogs as WorkflowState} />);
    expect(lastFrame()).toContain('LOGS');
  });

  it('should render log entries', () => {
    const { lastFrame } = render(<Logs state={mockStateWithLogs as WorkflowState} />);
    expect(lastFrame()).toContain('Task started');
    expect(lastFrame()).toContain('Writing file');
  });

  it('should handle null state', () => {
    const { lastFrame } = render(<Logs state={null} />);
    expect(lastFrame()).toContain('No workflow');
  });

  it('should handle empty logs', () => {
    const emptyState = { ...mockState, recentLogs: [] };
    const { lastFrame } = render(<Logs state={emptyState as WorkflowState} />);
    expect(lastFrame()).toContain('No logs');
  });
});
