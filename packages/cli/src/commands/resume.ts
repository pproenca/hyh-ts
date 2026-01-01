// packages/cli/src/commands/resume.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Resume a workflow from saved state')
    .option('-d, --dir <dir>', 'Project directory', '.')
    .action(async (options: { dir: string }) => {
      const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();
      const hyhDir = path.join(projectDir, '.hyh');
      const statePath = path.join(hyhDir, 'state.json');
      const workflowPath = path.join(hyhDir, 'workflow.json');

      // Check for existing state
      try {
        await fs.access(statePath);
      } catch {
        // State file doesn't exist - workflow was never started
        console.error('No workflow state found. Start a workflow first with `hyh run`.');
        process.exit(1);
      }

      // Check for existing workflow
      try {
        await fs.access(workflowPath);
      } catch {
        // Workflow file doesn't exist - needs compilation
        console.error('No compiled workflow found. Run `hyh compile` first.');
        process.exit(1);
      }

      // Check for running daemon
      const socketPath = await findSocketPath();
      if (socketPath) {
        console.log('Connecting to running daemon...');
        const client = new IPCClient(socketPath);
        try {
          await client.connect();
          const response = await client.request({ command: 'get_state' });
          if (response.status === 'ok') {
            // Response data structure is guaranteed by daemon for get_state command
            const data = response.data as { state: { currentPhase: string; workflowName: string } };
            console.log(`Connected to workflow: ${data.state.workflowName}`);
            console.log(`Current phase: ${data.state.currentPhase}`);
          }
          await client.disconnect();
          return;
        } catch {
          // Connection failed - daemon socket exists but daemon not responding
          console.log('Daemon not responding, starting new instance...');
        }
      }

      // Start daemon with existing state
      console.log('Resuming workflow...');
      try {
        const { Daemon, EventLoop } = await import('@hyh/daemon');
        const daemon = new Daemon({ worktreeRoot: projectDir });
        await daemon.start();
        await daemon.loadWorkflow(workflowPath);

        // State is automatically loaded by StateManager
        const eventLoop = new EventLoop(daemon, { tickInterval: 1000 });
        eventLoop.start();

        console.log('Workflow resumed successfully');
        console.log(`Socket: ${daemon.getSocketPath()}`);

        process.on('SIGINT', async () => {
          eventLoop.stop();
          await daemon.stop();
          process.exit(0);
        });

        await new Promise(() => {});
      } catch (error) {
        console.error('Failed to resume:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
