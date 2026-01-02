// packages/cli/src/commands/init.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function createWorkflowTemplate(): string {
  return `import { workflow, agent, queue, correct } from '@hyh/dsl';

// Define agents
const orchestrator = agent('orchestrator')
  .model('opus')
  .role('coordinator')
  .tools('Read', 'Grep', 'Bash(hyh:*)');

const worker = agent('worker')
  .model('sonnet')
  .role('implementation')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(git:*)', 'Bash(hyh:*)')
  .rules(rule => [
    rule.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }),
  ]);

// Define queues
const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m');

// Define workflow
export default workflow('my-feature')
  .resumable()
  .orchestrator(orchestrator)

  .phase('plan')
    .agent(orchestrator)
    .output('plan.md', 'tasks.md')
    .populates(tasks)
    .checkpoint(actor => actor.human.approval())

  .phase('implement')
    .queue(tasks)
    .agent(worker)
    .parallel()

  .build();
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new workflow project')
    .option('-d, --dir <directory>', 'Target directory', '.')
    .action(async (options: { dir: string }) => {
      const targetDir = path.resolve(options.dir);
      const workflowPath = path.join(targetDir, 'workflow.ts');
      const hyhDir = path.join(targetDir, '.hyh');

      // Check if workflow.ts already exists
      try {
        await fs.access(workflowPath);
        console.error('workflow.ts already exists');
        process.exit(1);
      } catch {
        // File doesn't exist - this is the expected case, proceed with creation
      }

      // Create workflow.ts
      await fs.writeFile(workflowPath, createWorkflowTemplate());
      console.log('Created workflow.ts');

      // Create .hyh directory
      await fs.mkdir(hyhDir, { recursive: true });
      console.log('Created .hyh/');

      console.log('\nNext steps:');
      console.log('  1. Edit workflow.ts to define your workflow');
      console.log('  2. Run: hyh validate workflow.ts');
      console.log('  3. Run: hyh run workflow.ts');
    });
}
