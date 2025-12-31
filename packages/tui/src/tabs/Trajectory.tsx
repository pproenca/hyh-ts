// packages/tui/src/tabs/Trajectory.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState, TrajectoryEvent } from '@hyh/daemon';

interface TrajectoryProps {
  state: WorkflowState | null;
}

export function Trajectory({ state }: TrajectoryProps) {
  if (!state) {
    return (
      <Box padding={1}>
        <Text dimColor>No workflow active</Text>
      </Box>
    );
  }

  const events = (state as WorkflowState & { trajectory?: TrajectoryEvent[] }).trajectory ?? [];

  if (events.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>TRAJECTORY</Text>
        <Text dimColor>No events recorded</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TRAJECTORY</Text>
      <Text dimColor>{events.length} events</Text>
      <Box flexDirection="column" marginTop={1}>
        {events.slice(-15).map((event, i) => {
          const time = new Date(event.timestamp ?? Date.now()).toLocaleTimeString();
          return (
            <Text key={i}>
              <Text dimColor>{time}</Text>
              <Text color="yellow"> [{event.type}]</Text>
              {'agentId' in event && <Text color="cyan"> {event.agentId}</Text>}
              {'tool' in event && <Text> {event.tool}</Text>}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
