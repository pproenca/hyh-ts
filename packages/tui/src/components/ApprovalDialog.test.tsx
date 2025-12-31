// packages/tui/src/components/ApprovalDialog.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ApprovalDialog } from './ApprovalDialog.js';

describe('ApprovalDialog', () => {
  const mockCheckpoint = {
    id: 'cp-1',
    question: 'Ready to merge?',
  };

  it('should render the question', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={mockCheckpoint} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Ready to merge?');
  });

  it('should show approve/reject options', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={mockCheckpoint} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Approve');
    expect(lastFrame()).toContain('Reject');
  });

  it('should show default question when none provided', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-2' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Approve to continue?');
  });
});
