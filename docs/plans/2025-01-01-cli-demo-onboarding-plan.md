# CLI Demo & Onboarding Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-cli-demo-onboarding-plan.md` to implement task-by-task.

**Goal:** Create `hyh demo` command with pre-built workflow simulation and interactive workflow builder, using Ink + React (Claude Code stack).

**Architecture:** Single demo command with two modes (`hyh demo` for simulation, `hyh demo --create` for builder). Components in `packages/cli/src/components/`, hook in `packages/cli/src/hooks/`. Reuses existing TUI patterns from `@hyh/tui`.

**Tech Stack:** TypeScript, React, Ink, @inkjs/ui (spinners/progress/select), chalk (colors), Commander.js

---

## Task 1: Add Dependencies

**Files:**
- Modify: `packages/cli/package.json`

**Step 1: Add @inkjs/ui and chalk dependencies** (2-5 min)

```bash
pnpm --filter @hyh/cli add @inkjs/ui chalk
```

**Step 2: Verify dependencies installed** (30 sec)

```bash
cat packages/cli/package.json | grep -E "@inkjs/ui|chalk"
```

Expected: Both dependencies appear in the dependencies section.

**Step 3: Commit** (30 sec)

```bash
git add packages/cli/package.json pnpm-lock.yaml
git commit -m "chore(cli): add @inkjs/ui and chalk dependencies"
```

---

## Task 2: Create useSimulation Hook

**Files:**
- Create: `packages/cli/src/hooks/useSimulation.ts`
- Create: `packages/cli/src/hooks/useSimulation.test.ts`

**Step 1: Write the failing test** (2-5 min)

Create `packages/cli/src/hooks/useSimulation.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/hooks/useSimulation.test.ts
```

Expected: FAIL with `Cannot find module './useSimulation.js'`

**Step 3: Write minimal implementation** (2-5 min)

Create `packages/cli/src/hooks/useSimulation.ts`:

```typescript
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

export function useSimulation(
  steps: SimulationStep[],
  intervalMs: number = 800
): SimulationState {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= steps.length - 1) return;

    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [stepIndex, steps.length, intervalMs]);

  const isComplete = stepIndex >= steps.length - 1;
  const progress = steps.length > 1
    ? (stepIndex / (steps.length - 1)) * 100
    : 100;

  return {
    current: steps[stepIndex] ?? steps[0],
    stepIndex,
    isComplete,
    progress,
  };
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/hooks/useSimulation.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/hooks/
git commit -m "feat(cli): add useSimulation hook for demo animation"
```

---

## Task 3: Create Banner Component

**Files:**
- Create: `packages/cli/src/components/Banner.tsx`
- Create: `packages/cli/src/components/Banner.test.tsx`

**Step 1: Write the failing test** (2-5 min)

Create `packages/cli/src/components/Banner.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Banner } from './Banner.js';

describe('Banner', () => {
  it('renders hyh logo text', () => {
    const { lastFrame } = render(<Banner />);
    expect(lastFrame()).toContain('hyh');
  });

  it('renders tagline', () => {
    const { lastFrame } = render(<Banner />);
    expect(lastFrame()).toContain('Hold Your Horses');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/components/Banner.test.tsx
```

Expected: FAIL with `Cannot find module './Banner.js'`

**Step 3: Write minimal implementation** (2-5 min)

Create `packages/cli/src/components/Banner.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';

export function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {`
  _           _
 | |__  _   _| |__
 | '_ \\| | | | '_ \\
 | | | | |_| | | | |
 |_| |_|\\__, |_| |_|
        |___/
        `.trim()}
      </Text>
      <Text dimColor>Hold Your Horses - Workflow Orchestration</Text>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/components/Banner.test.tsx
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/components/Banner.tsx packages/cli/src/components/Banner.test.tsx
git commit -m "feat(cli): add Banner component with ASCII logo"
```

---

## Task 4: Create Simulation Component

**Files:**
- Create: `packages/cli/src/components/Simulation.tsx`
- Create: `packages/cli/src/components/Simulation.test.tsx`

**Step 1: Write the failing test** (2-5 min)

Create `packages/cli/src/components/Simulation.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
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

    vi.advanceTimersByTime(200);

    expect(onComplete).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/components/Simulation.test.tsx
```

Expected: FAIL with `Cannot find module './Simulation.js'`

**Step 3: Write minimal implementation** (2-5 min)

Create `packages/cli/src/components/Simulation.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { Spinner, ProgressBar } from '@inkjs/ui';
import { useSimulation } from '../hooks/useSimulation.js';
import type { SimulationStep, SimulationAgent, SimulationTask } from '../hooks/useSimulation.js';

interface SimulationProps {
  steps: SimulationStep[];
  intervalMs?: number;
  onComplete?: () => void;
}

function AgentCard({ agent }: { agent: SimulationAgent }) {
  const statusColor = agent.status === 'working' ? 'yellow' : agent.status === 'done' ? 'green' : 'gray';
  return (
    <Box marginRight={2}>
      <Text color={statusColor}>
        {agent.status === 'working' ? '● ' : agent.status === 'done' ? '✓ ' : '○ '}
      </Text>
      <Text bold>{agent.name}</Text>
      <Text dimColor> ({agent.model})</Text>
      {agent.status === 'working' && <Spinner label="" />}
    </Box>
  );
}

function TaskItem({ task }: { task: SimulationTask }) {
  const icon = task.status === 'completed' ? '✓' : task.status === 'running' ? '→' : '○';
  const color = task.status === 'completed' ? 'green' : task.status === 'running' ? 'yellow' : 'gray';
  return (
    <Box>
      <Text color={color}>{icon} </Text>
      <Text>{task.name}</Text>
      {task.agent && <Text dimColor> [{task.agent}]</Text>}
    </Box>
  );
}

export function Simulation({ steps, intervalMs = 800, onComplete }: SimulationProps) {
  const { current, isComplete, progress } = useSimulation(steps, intervalMs);
  const completeCalled = useRef(false);

  useEffect(() => {
    if (isComplete && onComplete && !completeCalled.current) {
      completeCalled.current = true;
      onComplete();
    }
  }, [isComplete, onComplete]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Phase: </Text>
        <Text>{current.phase}</Text>
      </Box>

      {current.agents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Agents:</Text>
          <Box>
            {current.agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </Box>
        </Box>
      )}

      {current.tasks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Tasks:</Text>
          {current.tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </Box>
      )}

      {current.events.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>Events:</Text>
          {current.events.slice(-3).map((event, i) => (
            <Text key={i} dimColor>  {event}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <ProgressBar value={Math.round(progress)} />
        <Text> {Math.round(progress)}%</Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/components/Simulation.test.tsx
```

Expected: PASS (4 passed)

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/components/Simulation.tsx packages/cli/src/components/Simulation.test.tsx
git commit -m "feat(cli): add Simulation component with agents/tasks display"
```

---

## Task 5: Create Builder Component

**Files:**
- Create: `packages/cli/src/components/Builder.tsx`
- Create: `packages/cli/src/components/Builder.test.tsx`

**Step 1: Write the failing test** (2-5 min)

Create `packages/cli/src/components/Builder.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Builder } from './Builder.js';

describe('Builder', () => {
  it('renders workflow name prompt initially', () => {
    const { lastFrame } = render(<Builder onComplete={vi.fn()} />);
    expect(lastFrame()).toContain('Workflow name');
  });

  it('accepts onComplete callback', () => {
    const onComplete = vi.fn();
    const { lastFrame } = render(<Builder onComplete={onComplete} />);
    expect(lastFrame()).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/components/Builder.test.tsx
```

Expected: FAIL with `Cannot find module './Builder.js'`

**Step 3: Write minimal implementation** (2-5 min)

Create `packages/cli/src/components/Builder.tsx`:

```typescript
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput, Select, Confirm } from '@inkjs/ui';

interface WorkflowConfig {
  name: string;
  model: 'opus' | 'sonnet';
  parallel: number;
}

interface BuilderProps {
  onComplete: (config: WorkflowConfig) => void;
}

type BuilderStep = 'name' | 'model' | 'parallel' | 'confirm';

export function Builder({ onComplete }: BuilderProps) {
  const [step, setStep] = useState<BuilderStep>('name');
  const [config, setConfig] = useState<Partial<WorkflowConfig>>({});

  const handleNameSubmit = (value: string) => {
    setConfig((c) => ({ ...c, name: value }));
    setStep('model');
  };

  const handleModelSelect = (value: string) => {
    setConfig((c) => ({ ...c, model: value as 'opus' | 'sonnet' }));
    setStep('parallel');
  };

  const handleParallelSelect = (value: string) => {
    setConfig((c) => ({ ...c, parallel: parseInt(value, 10) }));
    setStep('confirm');
  };

  const handleConfirm = (confirmed: boolean) => {
    if (confirmed && config.name && config.model && config.parallel) {
      onComplete(config as WorkflowConfig);
    } else {
      setStep('name');
      setConfig({});
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan" marginBottom={1}>
        Create Your Workflow
      </Text>

      {step === 'name' && (
        <Box>
          <Text>Workflow name: </Text>
          <TextInput
            placeholder="my-feature"
            onSubmit={handleNameSubmit}
          />
        </Box>
      )}

      {step === 'model' && (
        <Box flexDirection="column">
          <Text>Select orchestrator model:</Text>
          <Select
            options={[
              { label: 'Opus (most capable)', value: 'opus' },
              { label: 'Sonnet (faster)', value: 'sonnet' },
            ]}
            onChange={handleModelSelect}
          />
        </Box>
      )}

      {step === 'parallel' && (
        <Box flexDirection="column">
          <Text>Max parallel agents:</Text>
          <Select
            options={[
              { label: '1 (sequential)', value: '1' },
              { label: '2', value: '2' },
              { label: '3 (recommended)', value: '3' },
              { label: '5', value: '5' },
            ]}
            onChange={handleParallelSelect}
          />
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text>Create workflow "{config.name}" with {config.model} and {config.parallel} parallel agents?</Text>
          <Confirm onConfirm={handleConfirm} />
        </Box>
      )}
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/components/Builder.test.tsx
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/components/Builder.tsx packages/cli/src/components/Builder.test.tsx
git commit -m "feat(cli): add Builder component for interactive workflow creation"
```

---

## Task 6: Create Demo Command with Mock Workflow Data

**Files:**
- Create: `packages/cli/src/commands/demo.ts`
- Create: `packages/cli/src/commands/demo.test.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the failing test** (2-5 min)

Create `packages/cli/src/commands/demo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerDemoCommand } from './demo.js';

describe('hyh demo', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerDemoCommand(program);
    vi.clearAllMocks();
  });

  it('registers demo command', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    expect(demoCommand).toBeDefined();
  });

  it('has --create option', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    const createOption = demoCommand?.options.find((opt) => opt.long === '--create');
    expect(createOption).toBeDefined();
  });

  it('has --speed option', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    const speedOption = demoCommand?.options.find((opt) => opt.long === '--speed');
    expect(speedOption).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/demo.test.ts
```

Expected: FAIL with `Cannot find module './demo.js'`

**Step 3: Write minimal implementation** (2-5 min)

Create `packages/cli/src/commands/demo.ts`:

```typescript
import { Command } from 'commander';
import React from 'react';
import { render, Box, Text } from 'ink';
import chalk from 'chalk';
import { Banner } from '../components/Banner.js';
import { Simulation } from '../components/Simulation.js';
import { Builder } from '../components/Builder.js';
import type { SimulationStep } from '../hooks/useSimulation.js';

interface DemoOptions {
  create: boolean;
  speed: string;
}

// Pre-built demo workflow simulation steps
function createDemoSteps(): SimulationStep[] {
  return [
    {
      phase: 'Starting',
      agents: [],
      tasks: [],
      events: ['Initializing workflow...'],
    },
    {
      phase: 'plan',
      agents: [{ name: 'orchestrator', model: 'opus', status: 'working' }],
      tasks: [],
      events: ['Orchestrator analyzing requirements...'],
    },
    {
      phase: 'plan',
      agents: [{ name: 'orchestrator', model: 'opus', status: 'working' }],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'running' },
      ],
      events: ['Creating task breakdown...'],
    },
    {
      phase: 'plan',
      agents: [{ name: 'orchestrator', model: 'opus', status: 'done' }],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'pending' },
        { id: '3', name: 'Add tests', status: 'pending' },
      ],
      events: ['Plan complete. Populating task queue...'],
    },
    {
      phase: 'implement',
      agents: [
        { name: 'orchestrator', model: 'opus', status: 'idle' },
        { name: 'worker-1', model: 'sonnet', status: 'working', currentTask: 'Implement auth module' },
      ],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'running', agent: 'worker-1' },
        { id: '3', name: 'Add tests', status: 'pending' },
      ],
      events: ['Worker-1 claimed task: Implement auth module'],
    },
    {
      phase: 'implement',
      agents: [
        { name: 'orchestrator', model: 'opus', status: 'idle' },
        { name: 'worker-1', model: 'sonnet', status: 'working', currentTask: 'Implement auth module' },
        { name: 'worker-2', model: 'sonnet', status: 'working', currentTask: 'Add tests' },
      ],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'running', agent: 'worker-1' },
        { id: '3', name: 'Add tests', status: 'running', agent: 'worker-2' },
      ],
      events: ['Worker-2 claimed task: Add tests', 'TDD checker: test file created first ✓'],
    },
    {
      phase: 'implement',
      agents: [
        { name: 'orchestrator', model: 'opus', status: 'idle' },
        { name: 'worker-1', model: 'sonnet', status: 'done' },
        { name: 'worker-2', model: 'sonnet', status: 'working', currentTask: 'Add tests' },
      ],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'completed', agent: 'worker-1' },
        { id: '3', name: 'Add tests', status: 'running', agent: 'worker-2' },
      ],
      events: ['Worker-1 completed: Implement auth module'],
    },
    {
      phase: 'verify',
      agents: [
        { name: 'orchestrator', model: 'opus', status: 'working' },
        { name: 'worker-1', model: 'sonnet', status: 'done' },
        { name: 'worker-2', model: 'sonnet', status: 'done' },
      ],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'completed' },
        { id: '3', name: 'Add tests', status: 'completed' },
      ],
      events: ['All tasks complete. Running verification...'],
    },
    {
      phase: 'Complete',
      agents: [
        { name: 'orchestrator', model: 'opus', status: 'done' },
        { name: 'worker-1', model: 'sonnet', status: 'done' },
        { name: 'worker-2', model: 'sonnet', status: 'done' },
      ],
      tasks: [
        { id: '1', name: 'Parse user story', status: 'completed' },
        { id: '2', name: 'Implement auth module', status: 'completed' },
        { id: '3', name: 'Add tests', status: 'completed' },
      ],
      events: ['Workflow completed successfully!'],
    },
  ];
}

function DemoApp({ mode, speed }: { mode: 'simulation' | 'create'; speed: number }) {
  const [showSummary, setShowSummary] = React.useState(false);

  const handleSimulationComplete = () => {
    setShowSummary(true);
  };

  const handleBuilderComplete = (config: { name: string; model: string; parallel: number }) => {
    console.log(chalk.green('\n✓ Workflow configuration created!'));
    console.log(chalk.dim(`  Name: ${config.name}`));
    console.log(chalk.dim(`  Model: ${config.model}`));
    console.log(chalk.dim(`  Parallel: ${config.parallel}`));
    console.log(chalk.cyan('\nNext: Run `hyh init` to generate workflow.ts'));
    process.exit(0);
  };

  if (showSummary) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="green" bold>✓ Demo complete!</Text>
        <Text dimColor>
          {'\n'}This is what hyh does: orchestrates multi-agent workflows with
        </Text>
        <Text dimColor>phases, parallel execution, and TDD enforcement.</Text>
        <Text>{'\n'}</Text>
        <Text>Try it yourself:</Text>
        <Text color="cyan">  hyh demo --create</Text>
        <Text dimColor>  Build your own workflow interactively</Text>
        <Text>{'\n'}</Text>
        <Text color="cyan">  hyh init</Text>
        <Text dimColor>  Initialize a new workflow project</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Banner />
      {mode === 'simulation' ? (
        <Simulation
          steps={createDemoSteps()}
          intervalMs={800 / speed}
          onComplete={handleSimulationComplete}
        />
      ) : (
        <Builder onComplete={handleBuilderComplete} />
      )}
    </Box>
  );
}

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('Interactive demo and onboarding')
    .option('-c, --create', 'Build your own workflow interactively', false)
    .option('-s, --speed <multiplier>', 'Simulation speed multiplier', '1')
    .addHelpText(
      'after',
      `
${chalk.bold('Examples:')}
  ${chalk.cyan('hyh demo')}           Run pre-built workflow simulation
  ${chalk.cyan('hyh demo --create')}  Build your own workflow interactively
`
    )
    .action((options: DemoOptions) => {
      const speed = parseFloat(options.speed) || 1;
      const mode = options.create ? 'create' : 'simulation';

      render(<DemoApp mode={mode} speed={speed} />);
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/demo.test.ts
```

Expected: PASS (3 passed)

**Step 5: Register demo command in CLI index** (2-5 min)

Edit `packages/cli/src/index.ts` to add the import and registration:

Add import at top:
```typescript
import { registerDemoCommand } from './commands/demo.js';
```

Add registration after other commands:
```typescript
registerDemoCommand(program);
```

**Step 6: Verify build works** (30 sec)

```bash
pnpm build
```

Expected: Build completes without errors.

**Step 7: Commit** (30 sec)

```bash
git add packages/cli/src/commands/demo.ts packages/cli/src/commands/demo.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add demo command with simulation and builder modes"
```

---

## Task 7: Integration Test and Manual Verification

**Files:**
- None (manual testing)

**Step 1: Run all tests** (2-5 min)

```bash
pnpm test
```

Expected: All tests pass.

**Step 2: Run typecheck** (30 sec)

```bash
pnpm typecheck
```

Expected: No type errors.

**Step 3: Manual test demo simulation** (2-5 min)

```bash
pnpm hyh demo
```

Expected: See animated banner, workflow simulation with phases, agents, tasks, progress bar, then summary.

**Step 4: Manual test demo create** (2-5 min)

```bash
pnpm hyh demo --create
```

Expected: See banner, then interactive prompts for workflow name, model, parallel count, confirmation.

**Step 5: Verify help output** (30 sec)

```bash
pnpm hyh demo --help
```

Expected: See colored help with examples.

**Step 6: Commit verification** (30 sec)

```bash
git add -A && git commit -m "test: verify demo command integration" --allow-empty
```

---

## Task 8: Code Review

**Files:**
- All files created/modified in this plan

**Step 1: Review all changes** (5 min)

```bash
git diff main..HEAD --stat
git log --oneline main..HEAD
```

Review for:
- Code follows existing patterns
- No unused imports
- Tests cover main functionality
- Components are composable

**Step 2: Run final verification** (30 sec)

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: All pass.

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Dependencies must be added first |
| Group 2 | 2, 3 | Hook and Banner have no file overlap |
| Group 3 | 4, 5 | Simulation and Builder have no file overlap |
| Group 4 | 6 | Demo command depends on components |
| Group 5 | 7, 8 | Integration test and code review |
