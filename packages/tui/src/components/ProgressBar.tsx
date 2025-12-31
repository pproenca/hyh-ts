import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  value: number;
  total: number;
  width?: number;
}

export function ProgressBar({ value, total, width = 40 }: ProgressBarProps) {
  const percentage = total > 0 ? value / total : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;

  return (
    <Box>
      <Text>[</Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text>]</Text>
      <Text> {value}/{total} ({Math.round(percentage * 100)}%)</Text>
    </Box>
  );
}
