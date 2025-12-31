import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from '../components/ProgressBar.js';
import type { WorkflowState } from '@hyh/daemon';

interface OverviewProps {
  state: WorkflowState | null;
}

export function Overview({ state }: OverviewProps) {
  if (!state) {
    return <Text dimColor>No workflow state</Text>;
  }

  const tasks = Object.values(state.tasks);
  const completed = tasks.filter(t => t.status === 'completed').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>PHASE: {state.currentPhase}</Text>
      <Box marginY={1}>
        <ProgressBar value={completed} total={tasks.length} />
      </Box>
      <Box flexDirection="column">
        <Text>Completed: <Text color="green">{completed}</Text></Text>
        <Text>Running: <Text color="yellow">{running}</Text></Text>
        <Text>Pending: <Text dimColor>{pending}</Text></Text>
      </Box>
    </Box>
  );
}
