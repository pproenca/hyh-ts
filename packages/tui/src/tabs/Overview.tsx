import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from '../components/ProgressBar.js';
import type { WorkflowState, TodoProgress } from '@hyh/daemon';

interface OverviewProps {
  state: WorkflowState | null;
}

function TodoProgressDisplay({ todo }: { todo?: TodoProgress }) {
  const total = todo?.total ?? 0;
  const completed = todo?.completed ?? 0;
  const incomplete = todo?.incomplete ?? [];

  if (!todo || total === 0) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Todo: {completed}/{total} ({pct}%)</Text>
      {incomplete.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {incomplete.slice(0, 5).map((item, i) => (
            <Text key={i} color="yellow">- {item}</Text>
          ))}
          {incomplete.length > 5 && (
            <Text dimColor>... and {incomplete.length - 5} more</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export function Overview({ state }: OverviewProps) {
  if (!state) {
    return <Text dimColor>No workflow state</Text>;
  }

  const tasks = Object.values(state.tasks ?? {});
  const completed = tasks.filter(t => t.status === 'completed').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  const agents = Object.values(state.agents ?? {});
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'idle');

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
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Agents:</Text>
        {activeAgents.length === 0 ? (
          <Text dimColor>No active agents</Text>
        ) : (
          activeAgents.map(agent => (
            <Box key={agent.id}>
              <Text>
                {agent.id} <Text dimColor>[{agent.status}]</Text>
                {agent.currentTask && (
                  <Text color="cyan"> working on {agent.currentTask}</Text>
                )}
              </Text>
            </Box>
          ))
        )}
      </Box>
      {state.todo && <TodoProgressDisplay todo={state.todo} />}
    </Box>
  );
}
