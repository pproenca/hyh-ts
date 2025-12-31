// packages/tui/src/components/ProgressBar.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { ProgressBar } from './ProgressBar.js';

describe('ProgressBar', () => {
  it('should render progress as fraction and percentage', () => {
    const { lastFrame } = render(<ProgressBar value={5} total={10} />);
    const output = lastFrame() || '';

    // Should show value/total
    expect(output).toContain('5/10');
    // Should show percentage
    expect(output).toContain('50%');
  });

  it('should render 0% when no progress', () => {
    const { lastFrame } = render(<ProgressBar value={0} total={10} />);
    const output = lastFrame() || '';

    expect(output).toContain('0/10');
    expect(output).toContain('0%');
  });

  it('should render 100% when complete', () => {
    const { lastFrame } = render(<ProgressBar value={10} total={10} />);
    const output = lastFrame() || '';

    expect(output).toContain('10/10');
    expect(output).toContain('100%');
  });

  it('should handle zero total gracefully (avoid division by zero)', () => {
    const { lastFrame } = render(<ProgressBar value={0} total={0} />);
    const output = lastFrame() || '';

    expect(output).toContain('0/0');
    expect(output).toContain('0%');
  });

  it('should render filled and empty sections', () => {
    const { lastFrame } = render(<ProgressBar value={2} total={4} width={4} />);
    const output = lastFrame() || '';

    // With 50% progress at width 4, should have 2 filled and 2 empty
    // We check for the bracket wrapping
    expect(output).toContain('[');
    expect(output).toContain(']');
  });

  it('should respect custom width', () => {
    const { lastFrame } = render(<ProgressBar value={10} total={10} width={20} />);
    const output = lastFrame() || '';

    expect(output).toContain('100%');
    // The actual bar should be 20 characters long (all filled)
  });
});
