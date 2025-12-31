// packages/tui/src/tabs/Tasks.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface TasksProps {
  state: WorkflowState | null;
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  running: '●',
  pending: '○',
  failed: '✗',
};

export function Tasks({ state }: TasksProps) {
  if (!state) {
    return <Text dimColor>No tasks</Text>;
  }

  const tasks = Object.values(state.tasks);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TASKS ({tasks.length})</Text>
      {tasks.map(task => (
        <Box key={task.id} marginTop={1}>
          <Text>
            {STATUS_ICONS[task.status] || '?'} {task.id}
            <Text dimColor> - {task.description.slice(0, 40)}</Text>
            {task.claimedBy && <Text color="yellow"> [{task.claimedBy}]</Text>}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>
          ✓ completed  ● running  ○ pending  ✗ failed
        </Text>
      </Box>
    </Box>
  );
}
