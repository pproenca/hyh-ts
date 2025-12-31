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
      events: ['Worker-2 claimed task: Add tests', 'TDD checker: test file created first'],
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
        <Text color="green" bold>Demo complete!</Text>
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
