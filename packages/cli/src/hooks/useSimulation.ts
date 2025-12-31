import { useState, useEffect } from 'react';

export interface SimulationAgent {
  name: string;
  model: string;
  status: 'idle' | 'working' | 'done';
  currentTask?: string;
}

export interface SimulationTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed';
  agent?: string;
}

export interface SimulationStep {
  phase: string;
  agents: SimulationAgent[];
  tasks: SimulationTask[];
  events: string[];
}

export interface SimulationState {
  current: SimulationStep;
  stepIndex: number;
  isComplete: boolean;
  progress: number;
}

const EMPTY_STEP: SimulationStep = {
  phase: '',
  agents: [],
  tasks: [],
  events: [],
};

export function useSimulation(
  steps: SimulationStep[],
  intervalMs: number = 800
): SimulationState {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(steps.length === 0);

  useEffect(() => {
    if (isComplete || steps.length === 0) return;

    const timer = setInterval(() => {
      setStepIndex((i) => {
        const next = i + 1;
        if (next >= steps.length) {
          setIsComplete(true);
          return i;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isComplete, steps.length, intervalMs]);

  const progress = isComplete || steps.length === 0
    ? 100
    : (stepIndex / steps.length) * 100;

  return {
    current: steps[stepIndex] ?? EMPTY_STEP,
    stepIndex,
    isComplete,
    progress,
  };
}
