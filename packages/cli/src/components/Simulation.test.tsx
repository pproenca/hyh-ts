// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { act } from '@testing-library/react';
import { Simulation } from './Simulation.js';
import type { SimulationStep } from '../hooks/useSimulation.js';

describe('Simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays current phase', () => {
    const steps: SimulationStep[] = [
      { phase: 'plan', agents: [], tasks: [], events: [] },
    ];
    const { lastFrame } = render(<Simulation steps={steps} />);
    expect(lastFrame()).toContain('plan');
  });

  it('displays agents with status', () => {
    const steps: SimulationStep[] = [
      {
        phase: 'plan',
        agents: [{ name: 'orchestrator', model: 'opus', status: 'working' }],
        tasks: [],
        events: [],
      },
    ];
    const { lastFrame } = render(<Simulation steps={steps} />);
    expect(lastFrame()).toContain('orchestrator');
  });

  it('displays tasks', () => {
    const steps: SimulationStep[] = [
      {
        phase: 'implement',
        agents: [],
        tasks: [{ id: '1', name: 'Build feature', status: 'running' }],
        events: [],
      },
    ];
    const { lastFrame } = render(<Simulation steps={steps} />);
    expect(lastFrame()).toContain('Build feature');
  });

  it('calls onComplete when simulation finishes', () => {
    const onComplete = vi.fn();
    const steps: SimulationStep[] = [
      { phase: 'plan', agents: [], tasks: [], events: [] },
      { phase: 'done', agents: [], tasks: [], events: [] },
    ];
    render(<Simulation steps={steps} intervalMs={100} onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});
