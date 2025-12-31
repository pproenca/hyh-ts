// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Banner } from './Banner.js';

describe('Banner', () => {
  it('renders hyh logo text', () => {
    const { lastFrame } = render(<Banner />);
    expect(lastFrame()).toContain('hyh');
  });

  it('renders tagline', () => {
    const { lastFrame } = render(<Banner />);
    expect(lastFrame()).toContain('Hold Your Horses');
  });
});
