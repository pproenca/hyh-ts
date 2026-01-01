// packages/cli/src/commands/dev.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Run workflow in development mode with watch')
    .argument('[workflow]', 'Path to workflow.ts', 'workflow.ts')
    .option('--no-tui', 'Disable TUI, use log output')
    .option('--port <port>', 'Socket port for TUI connection')
    .action(async (workflowPath: string, options: { tui: boolean; port?: string }) => {
      const absolutePath = path.resolve(workflowPath);

      if (!fs.existsSync(absolutePath)) {
        console.error(`Workflow file not found: ${absolutePath}`);
        process.exit(1);
      }

      const projectDir = path.dirname(absolutePath);
      const outputDir = path.join(projectDir, '.hyh');

      console.log('Starting hyh in development mode...');
      console.log(`Workflow: ${absolutePath}`);

      try {
        // Compile workflow
        const { compileToDir } = await import('@hyh/dsl');
        const { pathToFileURL } = await import('node:url');
        const workflowUrl = pathToFileURL(absolutePath).href;
        const module = await import(workflowUrl);
        const workflow = module.default ?? module.workflow ?? module;
        await compileToDir(workflow, outputDir);
        console.log('Workflow compiled to .hyh/');

        // Start daemon
        const { Daemon, EventLoop } = await import('@hyh/daemon');
        const daemon = new Daemon({ worktreeRoot: projectDir });
        await daemon.start();
        await daemon.loadWorkflow(path.join(outputDir, 'workflow.json'));
        console.log(`Daemon started: ${daemon.getSocketPath()}`);

        // Start event loop
        const eventLoop = new EventLoop(daemon, { tickInterval: 1000 });
        eventLoop.start();

        // Optionally start TUI
        if (options.tui !== false) {
          try {
            const { startTUI } = await import('@hyh/tui');
            startTUI(daemon.getSocketPath());
          } catch {
            // TUI package not installed or failed to load - fall back to headless mode
            console.log('TUI not available, running headless');
          }
        }

        // Handle shutdown
        process.on('SIGINT', async () => {
          console.log('\nShutting down...');
          eventLoop.stop();
          await daemon.stop();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        console.error('Failed to start:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
