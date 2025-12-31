// packages/cli/src/commands/logs.ts - replace entire file
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

interface LogEntry {
  timestamp: number;
  agentId: string;
  type: string;
  message: string;
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('View workflow execution logs')
    .option('-n, --lines <count>', 'Number of log lines to show', '20')
    .option('-a, --agent <id>', 'Filter logs by agent ID')
    .option('-f, --follow', 'Follow log output (not implemented)')
    .action(async (options) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow found. Start one with `hyh run`.');
        process.exit(1);
      }

      const client = new IPCClient(socketPath);
      try {
        await client.connect();

        const response = await client.request({
          command: 'get_logs',
          limit: parseInt(options.lines, 10),
          agentId: options.agent,
        } as unknown as Parameters<typeof client.request>[0]);

        if (response.status === 'ok') {
          const logs = (response.data as { logs: LogEntry[] }).logs;
          for (const log of logs) {
            const time = new Date(log.timestamp).toLocaleTimeString();
            console.log(`${time} [${log.agentId}] ${log.type}`);
          }
        } else {
          console.error('Failed to fetch logs:', response.message);
        }

        if (options.follow) {
          console.log('\n--follow mode not yet implemented');
        }

        await client.disconnect();
      } catch (error) {
        console.error('Connection error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
