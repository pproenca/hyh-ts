import React from 'react';
import { Box, Text } from 'ink';

export function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {`
  _           _
 | |__  _   _| |__
 | '_ \\| | | | '_ \\
 | | | | |_| | | | |
 |_| |_|\\__, |_| |_|
        |___/
        `.trim()}
      </Text>
      <Text dimColor>hyh - Hold Your Horses - Workflow Orchestration</Text>
    </Box>
  );
}
