// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulation } from './useSimulation.js';
import type { SimulationStep } from './useSimulation.js';

describe('useSimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at step 0 with correct initial state', () => {
    const steps: SimulationStep[] = [
      { phase: 'plan', agents: [], tasks: [], events: [] },
      { phase: 'implement', agents: [], tasks: [], events: [] },
    ];

    const { result } = renderHook(() => useSimulation(steps));

    expect(result.current.current.phase).toBe('plan');
    expect(result.current.isComplete).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('advances step after interval', () => {
    const steps: SimulationStep[] = [
      { phase: 'plan', agents: [], tasks: [], events: [] },
      { phase: 'implement', agents: [], tasks: [], events: [] },
    ];

    const { result } = renderHook(() => useSimulation(steps, 500));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.current.phase).toBe('implement');
    expect(result.current.progress).toBe(50);
  });

  it('stops at final step and marks complete', () => {
    const steps: SimulationStep[] = [
      { phase: 'plan', agents: [], tasks: [], events: [] },
      { phase: 'done', agents: [], tasks: [], events: [] },
    ];

    const { result } = renderHook(() => useSimulation(steps, 500));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.current.phase).toBe('done');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(100);
  });
});
