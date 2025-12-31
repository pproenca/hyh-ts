// packages/tui/src/index.tsx
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { useDaemon } from './hooks/useDaemon.js';
import { Overview } from './tabs/Overview.js';
import { Agents } from './tabs/Agents.js';
import { Tasks } from './tabs/Tasks.js';
import type { WorkflowState } from '@hyh/daemon';

const TABS = ['Overview', 'Agents', 'Tasks', 'Logs', 'Trajectory'] as const;

type TabComponent = React.ComponentType<{ state: WorkflowState | null }>;

const TAB_COMPONENTS: TabComponent[] = [Overview, Agents, Tasks, Overview, Overview];

interface AppProps {
  socketPath: string;
}

export function App({ socketPath }: AppProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { connected, state, error } = useDaemon(socketPath);

  useInput((input, _key) => {
    if (input >= '1' && input <= '5') {
      setActiveTab(parseInt(input) - 1);
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  if (error) {
    return <Text color="red">Error: {error.message}</Text>;
  }

  if (!connected) {
    return <Text dimColor>Connecting to {socketPath}...</Text>;
  }

  const CurrentTab = TAB_COMPONENTS[activeTab] ?? Overview;

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>hyh</Text>
        <Text dimColor> - {state?.workflowName || 'Unknown'}</Text>
        <Box marginLeft={2}>
          {TABS.map((tab, i) => (
            <Text key={tab}>
              {i === activeTab ? (
                <Text color="cyan">[{i + 1}] {tab}</Text>
              ) : (
                <Text>[{i + 1}] {tab}</Text>
              )}
              <Text>  </Text>
            </Text>
          ))}
        </Box>
      </Box>
      <CurrentTab state={state} />
      <Box marginTop={1}>
        <Text dimColor>[q] quit  [1-5] switch tabs</Text>
      </Box>
    </Box>
  );
}

export function startTUI(socketPath: string): void {
  render(<App socketPath={socketPath} />);
}
