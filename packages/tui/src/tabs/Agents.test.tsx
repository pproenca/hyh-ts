// packages/tui/src/tabs/Agents.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Agents } from './Agents.js';

describe('Agents Tab', () => {
  it('should render active agents with details', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {},
      checkpoints: {},
      pendingHumanActions: [],
      agents: {
        'orchestrator': {
          id: 'orchestrator',
          status: 'idle' as const,
          type: 'orchestrator',
          currentTask: null,
          pid: null,
          sessionId: null,
          lastHeartbeat: null,
          violationCounts: {},
        },
        'worker-1': {
          id: 'worker-1',
          status: 'active' as const,
          type: 'worker',
          currentTask: 'task-2',
          pid: null,
          sessionId: null,
          lastHeartbeat: null,
          violationCounts: {},
        },
      },
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

    expect(lastFrame()).toContain('orchestrator');
    expect(lastFrame()).toContain('worker-1');
    expect(lastFrame()).toContain('task-2');
  });

  it('should show attach hint when onAttach is provided', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {},
      checkpoints: {},
      pendingHumanActions: [],
      agents: {
        'worker-1': {
          id: 'worker-1',
          status: 'active' as const,
          type: 'worker',
          currentTask: 'task-1',
          pid: 1234,
          sessionId: 'session-1',
          lastHeartbeat: Date.now(),
          violationCounts: {},
        },
      },
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

    expect(lastFrame()).toContain('[a]');
  });

  it('should display last heartbeat time when available', () => {
    const heartbeatTime = Date.now() - 5000; // 5 seconds ago
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {},
      checkpoints: {},
      pendingHumanActions: [],
      agents: {
        'worker-1': {
          id: 'worker-1',
          status: 'active' as const,
          type: 'worker',
          currentTask: 'task-1',
          pid: 1234,
          sessionId: 'session-1',
          lastHeartbeat: heartbeatTime,
          violationCounts: {},
        },
      },
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

    // Should contain some indicator of heartbeat
    expect(lastFrame()).toContain('5s ago');
  });

  it('should show no agents message when state is null', () => {
    const { lastFrame } = render(<Agents state={null} onAttach={() => {}} />);

    expect(lastFrame()).toContain('No agents');
  });

  it('should show no agents message when agents object is empty', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {},
      checkpoints: {},
      pendingHumanActions: [],
      agents: {},
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

    expect(lastFrame()).toContain('No agents');
  });

  it('should display agent status indicators correctly', () => {
    const state = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {},
      checkpoints: {},
      pendingHumanActions: [],
      agents: {
        'active-agent': {
          id: 'active-agent',
          status: 'active' as const,
          type: 'worker',
          currentTask: null,
          pid: null,
          sessionId: null,
          lastHeartbeat: null,
          violationCounts: {},
        },
        'idle-agent': {
          id: 'idle-agent',
          status: 'idle' as const,
          type: 'worker',
          currentTask: null,
          pid: null,
          sessionId: null,
          lastHeartbeat: null,
          violationCounts: {},
        },
        'stopped-agent': {
          id: 'stopped-agent',
          status: 'stopped' as const,
          type: 'worker',
          currentTask: null,
          pid: null,
          sessionId: null,
          lastHeartbeat: null,
          violationCounts: {},
        },
      },
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);
    const frame = lastFrame() || '';

    // Active should have filled circle
    expect(frame).toMatch(/active-agent/);
    expect(frame).toMatch(/idle-agent/);
    expect(frame).toMatch(/stopped-agent/);
  });

  describe('Context budget display', () => {
    it('should show context usage for each agent', () => {
      const state = {
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        startedAt: Date.now(),
        currentPhase: 'implementation',
        phaseHistory: [],
        tasks: {},
        checkpoints: {},
        pendingHumanActions: [],
        agents: {
          'worker-1': {
            id: 'worker-1',
            status: 'active' as const,
            type: 'worker',
            currentTask: null,
            pid: null,
            sessionId: null,
            lastHeartbeat: null,
            violationCounts: {},
            contextUsage: { current: 80000, max: 100000 },
          },
        },
      };

      const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

      expect(lastFrame()).toContain('Context: 80%');
    });

    it('should highlight when context is high', () => {
      const state = {
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        startedAt: Date.now(),
        currentPhase: 'implementation',
        phaseHistory: [],
        tasks: {},
        checkpoints: {},
        pendingHumanActions: [],
        agents: {
          'worker-1': {
            id: 'worker-1',
            status: 'active' as const,
            type: 'worker',
            currentTask: null,
            pid: null,
            sessionId: null,
            lastHeartbeat: null,
            violationCounts: {},
            contextUsage: { current: 90000, max: 100000 },
          },
        },
      };

      const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

      // Should show warning color for >80%
      expect(lastFrame()).toContain('90%');
    });

    it('should not show context usage when not available', () => {
      const state = {
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        startedAt: Date.now(),
        currentPhase: 'implementation',
        phaseHistory: [],
        tasks: {},
        checkpoints: {},
        pendingHumanActions: [],
        agents: {
          'worker-1': {
            id: 'worker-1',
            status: 'active' as const,
            type: 'worker',
            currentTask: null,
            pid: null,
            sessionId: null,
            lastHeartbeat: null,
            violationCounts: {},
          },
        },
      };

      const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

      expect(lastFrame()).not.toContain('Context:');
    });
  });
});
