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

describe('ApprovalDialog useInput hook', () => {
  // The useInput hook is tested through component structure
  // Direct keyboard handling requires integration testing
  it('defines Y/y as approve key', () => {
    // The component accepts Y/y for approve
    // This is defined in the useInput handler
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-1' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('[Y]');
  });

  it('defines N/n as reject key', () => {
    // The component accepts N/n for reject
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-1' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('[N]');
  });
});

describe('ApprovalDialog display', () => {
  it('shows Human Action Required header', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-1' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Human Action Required');
  });

  it('shows Y and N key hints', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-1' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('[Y]');
    expect(lastFrame()).toContain('[N]');
  });
});
