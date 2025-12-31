// packages/tui/src/tabs/Logs.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface LogEntry {
  timestamp: number;
  agentId: string;
  message: string;
}

interface LogsProps {
  state: WorkflowState | null;
}

export function Logs({ state }: LogsProps) {
  if (!state) {
    return (
      <Box padding={1}>
        <Text dimColor>No workflow active</Text>
      </Box>
    );
  }

  const logs = (state as WorkflowState & { recentLogs?: LogEntry[] }).recentLogs ?? [];

  if (logs.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>LOGS</Text>
        <Text dimColor>No logs yet</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>LOGS</Text>
      <Box flexDirection="column" marginTop={1}>
        {logs.slice(-20).map((log, i) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return (
            <Text key={i}>
              <Text dimColor>{time}</Text>
              <Text color="cyan"> {log.agentId}</Text>
              <Text> {log.message}</Text>
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
