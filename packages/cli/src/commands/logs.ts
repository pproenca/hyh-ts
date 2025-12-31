// packages/cli/src/commands/logs.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

interface LogEntry {
  timestamp: number;
  agentId: string;
  message: string;
}

interface LogsResponse {
  logs?: LogEntry[];
}

// Extended client interface for future log streaming support
interface ExtendedIPCClient extends IPCClient {
  on?(event: string, callback: (log: LogEntry) => void): void;
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Stream workflow logs')
    .option('-n, --lines <n>', 'Number of lines', '20')
    .option('-f, --follow', 'Follow log output')
    .option('--agent <id>', 'Filter by agent ID')
    .action(async (options: { lines: string; follow?: boolean; agent?: string }) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const client: ExtendedIPCClient = new IPCClient(socketPath);

      try {
        await client.connect();
        // Cast to unknown then to the expected shape since get_logs command
        // will be added in a future daemon update
        const response = await client.request({
          command: 'get_logs',
          limit: parseInt(options.lines),
          agentId: options.agent,
        } as unknown as Parameters<typeof client.request>[0]);

        if (response.status === 'ok') {
          const data = response.data as LogsResponse | undefined;
          const logs = data?.logs ?? [];
          for (const log of logs) {
            const time = new Date(log.timestamp).toLocaleTimeString();
            console.log(`${time} [${log.agentId}] ${log.message}`);
          }

          if (options.follow && client.on) {
            console.log('Following logs... (Ctrl+C to exit)');
            // Subscribe to log events
            client.on('log', (log: LogEntry) => {
              const time = new Date(log.timestamp).toLocaleTimeString();
              console.log(`${time} [${log.agentId}] ${log.message}`);
            });
          } else {
            await client.disconnect();
          }
        } else {
          console.error('Failed to get logs:', response.status === 'error' ? response.message : 'Unknown error');
          process.exit(1);
        }
      } catch (error) {
        console.error('Error:', (error as Error).message);
        await client.disconnect();
        process.exit(1);
      }
    });
}
