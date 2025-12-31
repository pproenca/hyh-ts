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

      console.log('Starting hyh in development mode...');
      console.log(`Workflow: ${absolutePath}`);

      // TODO: Implement file watching
      // TODO: Start daemon
      // TODO: Start TUI or log mode

      console.log('Development mode not fully implemented yet');
    });
}
