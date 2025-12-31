import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentAttach } from './AgentAttach.js';

describe('AgentAttach', () => {
  it('should render agent output stream', () => {
    const { lastFrame } = render(
      <AgentAttach
        agentId="worker-1"
        output={['Line 1', 'Line 2']}
        onDetach={vi.fn()}
      />
    );

    expect(lastFrame()).toContain('worker-1');
    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
  });

  it('should show detach instructions', () => {
    const { lastFrame } = render(
      <AgentAttach agentId="worker-1" output={[]} onDetach={vi.fn()} />
    );

    expect(lastFrame()).toContain('Ctrl+D');
  });
});
