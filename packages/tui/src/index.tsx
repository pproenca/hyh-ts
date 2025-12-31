// packages/tui/src/index.tsx
import React from 'react';
import { render, Box, Text } from 'ink';

interface AppProps {
  socketPath: string;
}

export function App({ socketPath }: AppProps) {
  return (
    <Box flexDirection="column">
      <Text bold>hyh - Hold Your Horses</Text>
      <Text dimColor>Connecting to {socketPath}...</Text>
    </Box>
  );
}

export function startTUI(socketPath: string): void {
  render(<App socketPath={socketPath} />);
}
