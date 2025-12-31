// packages/tui/src/integration/app.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../index.js';
import type { WorkflowState } from '@hyh/daemon';

// Create a valid WorkflowState for mocking
const mockState: WorkflowState = {
  workflowId: 'test',
  workflowName: 'Test Workflow',
  startedAt: Date.now(),
  currentPhase: 'implement',
  phaseHistory: [],
  tasks: {
    't1': {
      id: 't1',
      description: 'Task 1',
      status: 'completed',
      claimedBy: null,
      claimedAt: null,
      startedAt: Date.now() - 60000,
      completedAt: Date.now(),
      attempts: 1,
      lastError: null,
      dependencies: [],
      files: [],
      timeoutSeconds: 600,
    },
    't2': {
      id: 't2',
      description: 'Task 2',
      status: 'running',
      claimedBy: 'worker-1',
      claimedAt: Date.now(),
      startedAt: Date.now(),
      completedAt: null,
      attempts: 1,
      lastError: null,
      dependencies: [],
      files: [],
      timeoutSeconds: 600,
    },
    't3': {
      id: 't3',
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
  agents: {
    'worker-1': {
      id: 'worker-1',
      type: 'worker',
      status: 'active',
      currentTask: 't2',
      pid: 1234,
      sessionId: 'session-1',
      lastHeartbeat: Date.now(),
      violationCounts: {},
    },
  },
  checkpoints: {},
  pendingHumanActions: [],
};

// Mock useDaemon hook
vi.mock('../hooks/useDaemon.js', () => ({
  useDaemon: () => ({
    connected: true,
    state: mockState,
    events: [],
    error: null,
    refresh: vi.fn(),
  }),
}));

describe('App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all tabs', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('hyh');
    expect(output).toContain('Overview');
    expect(output).toContain('Agents');
    expect(output).toContain('Tasks');
    expect(output).toContain('Logs');
    expect(output).toContain('Trajectory');
  });

  it('should show workflow name', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('Test Workflow');
  });

  it('should show current phase', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('implement');
  });

  it('should show task progress in overview tab', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    // Overview tab shows by default - should show 1/3 completed
    expect(output).toContain('1/3');
  });

  it('should show keyboard shortcuts', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('[q] quit');
    expect(output).toContain('[1-5] switch tabs');
  });
});
