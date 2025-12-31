import React from 'react';
import { Box, Text, useInput } from 'ink';

interface AgentAttachProps {
  agentId: string;
  output: string[];
  onDetach: () => void;
}

export function AgentAttach({ agentId, output, onDetach }: AgentAttachProps) {
  useInput((input, key) => {
    if (key.ctrl && input === 'd') {
      onDetach();
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>Attached to </Text>
        <Text color="cyan">{agentId}</Text>
        <Text dimColor> (Ctrl+D to detach)</Text>
      </Box>
      <Box flexDirection="column" height={20} overflow="hidden">
        {output.slice(-20).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
