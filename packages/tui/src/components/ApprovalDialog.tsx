// packages/tui/src/components/ApprovalDialog.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Checkpoint {
  id: string;
  question?: string;
}

interface ApprovalDialogProps {
  checkpoint: Checkpoint;
  onAction: (action: 'approve' | 'reject') => void;
}

export function ApprovalDialog({ checkpoint, onAction }: ApprovalDialogProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') {
      onAction('approve');
    } else if (input === 'n' || input === 'N') {
      onAction('reject');
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      padding={1}
    >
      <Text bold color="yellow">Human Action Required</Text>
      <Box marginTop={1}>
        <Text>{checkpoint.question || 'Approve to continue?'}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>[Y] Approve  [N] Reject</Text>
      </Box>
    </Box>
  );
}
