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

describe('AgentBuilder.spawns', () => {
  it('tracks spawns relationship between agents', () => {
    const worker = agent('worker').model('sonnet');
    const orch = agent('orchestrator').model('opus').spawns(worker);

    const compiled = orch.build();
    expect(compiled.spawns).toContain('worker');
  });

  it('supports multiple spawns relationships', () => {
    const dev1 = agent('developer-1').model('sonnet');
    const dev2 = agent('developer-2').model('sonnet');
    const orch = agent('orchestrator')
      .model('opus')
      .spawns(dev1)
      .spawns(dev2);

    const compiled = orch.build();
    expect(compiled.spawns).toContain('developer-1');
    expect(compiled.spawns).toContain('developer-2');
    expect(compiled.spawns).toHaveLength(2);
  });
});

describe('AgentBuilder.heartbeat', () => {
  it('configures heartbeat with interval', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .build();

    expect(ag.heartbeat).toBeDefined();
    expect(ag.heartbeat?.interval).toBe(30000);
  });

  it('configures heartbeat with onMiss correction', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .onMiss({ type: 'prompt', message: 'Are you still working?' })
      .build();

    expect(ag.heartbeat?.corrections).toHaveLength(1);
    expect(ag.heartbeat?.corrections[0]?.correction.type).toBe('prompt');
  });

  it('chains multiple onMiss corrections with counts', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .onMiss({ type: 'prompt', message: 'Check in please' })
      .onMiss(2, { type: 'warn', message: 'Second warning' })
      .onMiss(3, { type: 'restart' })
      .build();

    expect(ag.heartbeat?.corrections).toHaveLength(3);
    expect(ag.heartbeat?.corrections[0]?.count).toBe(1);
    expect(ag.heartbeat?.corrections[1]?.count).toBe(2);
    expect(ag.heartbeat?.corrections[2]?.count).toBe(3);
  });
});

describe('AgentBuilder.invariants', () => {
  it('adds invariants to agent', () => {
    const ag = agent('worker')
      .model('sonnet')
      .invariants(
        { type: 'tdd', commitAfterTest: true },
        { type: 'fileScope', allowed: ['src/'] }
      )
      .build();

    expect(ag.invariants).toHaveLength(2);
    expect(ag.invariants[0]?.type).toBe('tdd');
    expect(ag.invariants[1]?.type).toBe('fileScope');
  });
});

describe('AgentBuilder.onViolation', () => {
  it('binds correction to violation type', () => {
    const ag = agent('worker')
      .model('sonnet')
      .onViolation('tdd', { type: 'prompt', message: 'Write tests first!' })
      .build();

    expect(ag.violations['tdd']).toBeDefined();
    expect(ag.violations['tdd']![0]?.type).toBe('prompt');
  });

  it('supports multiple corrections per violation type', () => {
    const ag = agent('worker')
      .model('sonnet')
      .onViolation('fileScope', { type: 'prompt', message: 'Stay in scope' })
      .onViolation('fileScope', { type: 'block', message: 'Blocked' })
      .build();

    expect(ag.violations['fileScope']).toHaveLength(2);
  });

  it('supports onViolation with after count option', () => {
    const ag = agent('worker')
      .model('sonnet')
      .onViolation('tdd', { after: 2 }, { type: 'restart' })
      .build();

    expect(ag.violations['tdd']).toBeDefined();
    expect(ag.violations['tdd']![0]?.type).toBe('restart');
  });
});
