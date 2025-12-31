// packages/cli/src/commands/run.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a workflow')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('--no-tui', 'Run without TUI (headless mode)')
    .action(async (workflowPath: string, options: { tui: boolean }) => {
      const absolutePath = path.resolve(workflowPath);
      const projectDir = path.dirname(absolutePath);
      const outputDir = path.join(projectDir, '.hyh');

      // Check file exists
      try {
        await fs.access(absolutePath);
      } catch {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log(`Compiling ${workflowPath}...`);

      try {
        // Dynamic import of the workflow file
        const workflowUrl = pathToFileURL(absolutePath).href;
        const module = await import(workflowUrl);
        const workflow = module.default;

        if (!workflow || typeof workflow !== 'object') {
          console.error('Workflow file must export default workflow');
          process.exit(1);
        }

        // Import and run compileToDir
        const { compileToDir } = await import('@hyh/dsl');
        await compileToDir(workflow, outputDir);
        console.log(`Compiled to ${outputDir}`);

        // Import and start daemon
        const { Daemon } = await import('@hyh/daemon');
        const daemon = new Daemon({ worktreeRoot: projectDir });
        await daemon.start();
        console.log(`Daemon started on ${daemon.getSocketPath()}`);

        // Keep running until interrupted
        process.on('SIGINT', async () => {
          console.log('\nShutting down...');
          await daemon.stop();
          process.exit(0);
        });

        if (!options.tui) {
          console.log('Running in headless mode. Press Ctrl+C to stop.');
        } else {
          console.log('TUI not yet implemented. Running in headless mode.');
        }
      } catch (error) {
        console.error('Failed to run workflow:', error);
        process.exit(1);
      }
    });
}
