// packages/cli/src/commands/status.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show workflow status')
    .option('-q, --quiet', 'Minimal output')
    .option('-n, --events <count>', 'Number of recent events to show', '10')
    .action(async (options) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        if (!options.quiet) {
          console.log('No active workflow');
        }
        return;
      }

      const client = new IPCClient(socketPath);
      try {
        await client.connect();
        const response = await client.request({
          command: 'status',
          eventCount: parseInt(options.events, 10),
        });

        if (response.status !== 'ok') {
          console.error('Error:', response.status === 'error' ? response.message : 'Unknown error');
          process.exit(1);
        }

        // Response data structure is guaranteed by daemon for status command
        const data = response.data as {
          active: boolean;
          summary: { total: number; completed: number; running: number; pending: number };
          activeWorkers: string[];
        };

        if (options.quiet) {
          console.log(data.active ? 'active' : 'inactive');
          return;
        }

        console.log(`Workflow Status: ${data.active ? 'Active' : 'Inactive'}`);
        console.log(`Tasks: ${data.summary.completed}/${data.summary.total} completed`);
        console.log(`  Running: ${data.summary.running}`);
        console.log(`  Pending: ${data.summary.pending}`);
        if (data.activeWorkers.length > 0) {
          console.log(`Active Workers: ${data.activeWorkers.join(', ')}`);
        }
      } finally {
        await client.disconnect();
      }
    });
}
