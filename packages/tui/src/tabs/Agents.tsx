// packages/tui/src/tabs/Agents.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface AgentsProps {
  state: WorkflowState | null;
}

export function Agents({ state }: AgentsProps) {
  if (!state) {
    return <Text dimColor>No agents</Text>;
  }

  const agents = Object.values(state.agents);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>AGENTS ({agents.length})</Text>
      {agents.map(agent => (
        <Box key={agent.id} marginTop={1}>
          <Text>
            {agent.status === 'active' ? '●' : '○'} {agent.id}
            <Text dimColor> ({agent.type})</Text>
            {agent.currentTask && <Text color="yellow"> → {agent.currentTask}</Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
