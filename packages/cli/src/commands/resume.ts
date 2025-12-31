// packages/cli/src/commands/resume.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Resume a workflow from saved state')
    .option('-d, --dir <dir>', 'Project directory', '.')
    .action(async (options: { dir: string }) => {
      const projectDir = path.resolve(options.dir);
      const stateFile = path.join(projectDir, '.hyh', 'state.json');

      try {
        await fs.access(stateFile);
      } catch {
        console.error('No saved state found');
        console.error(`Looking for: ${stateFile}`);
        process.exit(1);
      }

      console.log('Resuming workflow from saved state...');
      console.log(`State file: ${stateFile}`);

      // Load and validate state
      const stateContent = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(stateContent);

      console.log(`Workflow: ${state.workflowName || 'Unknown'}`);
      console.log(`Phase: ${state.currentPhase || 'Unknown'}`);

      // TODO: Start daemon with resumeFrom option
      console.log('Resume not fully implemented yet');
    });
}
