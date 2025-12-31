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

describe('AgentBuilder anti-abandonment', () => {
  it('adds postToolUse configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .postToolUse({
        matcher: 'Write|Edit',
        run: ['npm run typecheck', 'npm run lint --fix'],
      });

    const compiled = ag.build();
    expect(compiled.postToolUse).toBeDefined();
    expect(compiled.postToolUse?.matcher).toBe('Write|Edit');
    expect(compiled.postToolUse?.commands).toContain('npm run typecheck');
  });

  it('adds subagentStop configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .subagentStop({
        verify: ['npm test', 'hyh verify-complete'],
      });

    const compiled = ag.build();
    expect(compiled.subagentStop).toBeDefined();
    expect(compiled.subagentStop?.verify).toContain('npm test');
  });

  it('adds reinject configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .reinject({
        every: 5,
        content: 'Stay focused on the task',
      });

    const compiled = ag.build();
    expect(compiled.reinject).toBeDefined();
    expect(compiled.reinject?.every).toBe(5);
  });
});
