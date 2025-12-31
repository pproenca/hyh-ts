// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Builder } from './Builder.js';

describe('Builder', () => {
  it('renders workflow name prompt initially', () => {
    const { lastFrame } = render(<Builder onComplete={vi.fn()} />);
    expect(lastFrame()).toContain('Workflow name');
  });

  it('accepts onComplete callback', () => {
    const onComplete = vi.fn();
    const { lastFrame } = render(<Builder onComplete={onComplete} />);
    expect(lastFrame()).toBeDefined();
  });
});
