// packages/tui/src/tabs/Trajectory.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Trajectory } from './Trajectory.js';
import type { WorkflowState } from '@hyh/daemon';

describe('Trajectory tab', () => {
  const mockState: WorkflowState = {
    workflowId: 'test',
    workflowName: 'test-workflow',
    startedAt: Date.now(),
    currentPhase: 'implement',
    phaseHistory: [],
    tasks: {},
    agents: {},
    checkpoints: {},
    pendingHumanActions: [],
    trajectory: [
      { type: 'spawn', timestamp: Date.now(), agentId: 'worker-1', agentType: 'worker' },
      { type: 'tool_use', timestamp: Date.now(), agentId: 'worker-1', tool: 'Read', args: { path: 'src/foo.ts' } },
    ],
  } as WorkflowState & { trajectory: unknown[] };

  it('should render trajectory header', () => {
    const { lastFrame } = render(<Trajectory state={mockState} />);
    expect(lastFrame()).toContain('TRAJECTORY');
  });

  it('should render trajectory events', () => {
    const { lastFrame } = render(<Trajectory state={mockState} />);
    expect(lastFrame()).toContain('spawn');
    expect(lastFrame()).toContain('tool_use');
  });

  it('should handle null state', () => {
    const { lastFrame } = render(<Trajectory state={null} />);
    expect(lastFrame()).toContain('No workflow');
  });
});
