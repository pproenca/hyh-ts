// packages/cli/src/commands/heartbeat.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';
import { getWorkerId } from '../utils/worker-id.js';

export function registerHeartbeatCommand(program: Command): void {
  program
    .command('heartbeat')
    .description('Send heartbeat to daemon')
    .action(async () => {
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
          command: 'heartbeat',
          workerId,
        });

        if (response.status === 'ok') {
          console.log('Heartbeat sent');
        } else {
          console.error('Heartbeat failed:', response.message);
          process.exit(1);
        }
      } finally {
        await client.disconnect();
      }
    });
}
