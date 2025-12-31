// packages/cli/src/commands/task.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';
import { getWorkerId } from '../utils/worker-id.js';

export function registerTaskCommand(program: Command): void {
  const taskCmd = program.command('task').description('Task management commands');

  taskCmd
    .command('claim')
    .description('Claim a task for this worker')
    .option('--role <role>', 'Filter by role (not yet implemented)')
    .action(async (_options: { role?: string }) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const workerId = await getWorkerId();
      const client = new IPCClient(socketPath);

      try {
        await client.connect();
        // Note: role filtering not yet implemented in daemon
        const response = await client.request({
          command: 'task_claim',
          workerId,
        });

        if (response.status !== 'ok') {
          console.error('Error:', response.status === 'error' ? response.message : 'Unknown error');
          process.exit(1);
        }

        const data = response.data as { task: unknown; isRetry: boolean; isReclaim: boolean };

        if (!data.task) {
          console.log('No tasks available');
          process.exit(0);
        }

        // Output task as JSON for agent consumption
        console.log(JSON.stringify(data.task, null, 2));

        if (data.isRetry) {
          console.error('\n[Retrying previous task]');
        }
        if (data.isReclaim) {
          console.error('\n[Reclaiming timed-out task]');
        }
      } finally {
        await client.disconnect();
      }
    });

  taskCmd
    .command('complete')
    .description('Mark a task as complete')
    .requiredOption('--id <taskId>', 'Task ID to complete')
    .option('--force', 'Force complete even if not owned')
    .action(async (options: { id: string; force?: boolean }) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const workerId = await getWorkerId();
      const client = new IPCClient(socketPath);

      try {
        await client.connect();
        const response = await client.request({
          command: 'task_complete',
          taskId: options.id,
          workerId,
          force: options.force ?? false,
        });

        if (response.status === 'error') {
          console.error('Error:', response.message);
          process.exit(1);
        }

        console.log(`Task ${options.id} completed`);
      } finally {
        await client.disconnect();
      }
    });

  taskCmd
    .command('reset')
    .description('Clear all tasks and reset workflow')
    .action(async () => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const client = new IPCClient(socketPath);

      try {
        await client.connect();
        const response = await client.request({
          command: 'plan_reset',
        });

        if (response.status === 'error') {
          console.error('Error:', response.message);
          process.exit(1);
        }

        console.log('Tasks reset successfully');
      } finally {
        await client.disconnect();
      }
    });
}
