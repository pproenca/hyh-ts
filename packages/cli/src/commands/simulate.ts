// packages/cli/src/commands/simulate.ts
import { Command } from 'commander';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CompiledWorkflow } from '@hyh/dsl';
import { MetricsCollector } from '@hyh/daemon';

interface SimulateOptions {
  speed: string;
  seed?: string;
  verbose: boolean;
}

interface MockAgentEvent {
  type: 'tool_use' | 'task_complete' | 'violation' | 'correction';
  agentId: string;
  data: Record<string, unknown>;
}

class MockAgent {
  constructor(
    private readonly name: string,
    private readonly speed: number,
    private readonly seed: number
  ) {}

  async *run(): AsyncGenerator<MockAgentEvent> {
    const random = this.seededRandom(this.seed);
    const toolCount = Math.floor(random() * 5) + 1;

    for (let i = 0; i < toolCount; i++) {
      await this.delay(100 / this.speed);
      yield {
        type: 'tool_use',
        agentId: this.name,
        data: { tool: `tool_${i}`, input: 'mock input' },
      };
    }

    // Random chance of violation
    if (random() < 0.2) {
      yield {
        type: 'violation',
        agentId: this.name,
        data: { invariant: 'tdd' },
      };
    }

    await this.delay(50 / this.speed);
    yield {
      type: 'task_complete',
      agentId: this.name,
      data: { success: true },
    };
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function registerSimulateCommand(program: Command): void {
  program
    .command('simulate')
    .description('Run workflow simulation with mock agents')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('-s, --speed <multiplier>', 'Simulation speed multiplier', '1')
    .option('--seed <number>', 'Random seed for reproducibility')
    .option('-v, --verbose', 'Show detailed event log', false)
    .action(async (workflowPath: string, options: SimulateOptions) => {
      try {
        const fullPath = path.resolve(process.cwd(), workflowPath);
        const { default: workflow } = (await import(pathToFileURL(fullPath).href)) as {
          default: CompiledWorkflow;
        };

        const speed = parseFloat(options.speed);
        const seed = options.seed ? parseInt(options.seed, 10) : Date.now();
        const metrics = new MetricsCollector();

        console.log(`Simulating workflow: ${workflow.name}`);
        console.log(`Speed: ${speed}x, Seed: ${seed}`);
        console.log('---');

        for (const [agentName] of Object.entries(workflow.agents)) {
          const agent = new MockAgent(agentName, speed, seed);

          for await (const event of agent.run()) {
            if (options.verbose) {
              console.log(`[${event.agentId}] ${event.type}:`, event.data);
            }

            switch (event.type) {
              case 'task_complete':
                metrics.recordTaskComplete(agentName, 1000);
                break;
              case 'violation':
                metrics.recordViolation(event.data.invariant as string);
                break;
              case 'tool_use':
                metrics.recordTokens(100); // Estimate
                break;
            }
          }
        }

        const summary = metrics.export();
        console.log('---');
        console.log('Simulation complete:');
        console.log(`  Tasks completed: ${summary.tasksCompleted}`);
        console.log(`  Violations: ${Object.values(summary.violationCount).reduce((a, b) => a + b, 0)}`);
        console.log(`  Estimated tokens: ${summary.estimatedTokensUsed}`);
        console.log(`  Duration: ${summary.totalDuration}ms`);
      } catch (error) {
        console.error('Simulation failed:', error);
        process.exit(1);
      }
    });
}
