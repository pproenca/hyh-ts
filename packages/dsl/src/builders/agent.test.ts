// packages/dsl/src/builders/agent.test.ts
import { describe, it, expect } from 'vitest';
import { agent } from './agent.js';

describe('AgentBuilder', () => {
  it('creates agent with name', () => {
    const a = agent('worker');
    expect(a.build().name).toBe('worker');
  });

  it('chains model and role', () => {
    const a = agent('worker').model('sonnet').role('implementation');
    const compiled = a.build();
    expect(compiled.model).toBe('sonnet');
    expect(compiled.role).toBe('implementation');
  });

  it('chains tools', () => {
    const a = agent('worker').tools('Read', 'Write', 'Bash(npm:*)');
    expect(a.build().tools).toEqual(['Read', 'Write', 'Bash(npm:*)']);
  });

  it('sets readOnly shorthand', () => {
    const a = agent('verifier').readOnly();
    const compiled = a.build();
    // readOnly should not include Write or Edit in tools
    expect(compiled.tools).not.toContain('Write');
    expect(compiled.tools).not.toContain('Edit');
  });
});
