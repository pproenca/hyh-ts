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

  it('configures heartbeat with misses(n).verb() pattern', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .misses(1).prompts('Are you still working?')
      .build();

    expect(ag.heartbeat?.corrections).toHaveLength(1);
    expect(ag.heartbeat?.corrections[0]?.count).toBe(1);
    expect(ag.heartbeat?.corrections[0]?.correction.type).toBe('prompt');
  });

  it('chains multiple misses with different counts', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .misses(1).prompts('Check in please')
      .misses(2).warns('Second warning')
      .misses(3).restarts()
      .build();

    expect(ag.heartbeat?.corrections).toHaveLength(3);
    expect(ag.heartbeat?.corrections[0]?.count).toBe(1);
    expect(ag.heartbeat?.corrections[1]?.count).toBe(2);
    expect(ag.heartbeat?.corrections[2]?.count).toBe(3);
  });
});

describe('AgentBuilder.rules with integrated corrections', () => {
  it('accepts callback with rule builder', () => {
    const ag = agent('worker')
      .model('sonnet')
      .rules(rule => [
        rule.noCode(),
        rule.mustProgress('15m')
      ])
      .build();

    expect(ag.rules).toHaveLength(2);
    expect(ag.rules[0]?.type).toBe('noCode');
    expect(ag.rules[1]?.type).toBe('mustProgress');
  });

  it('supports rule with correction verbs', () => {
    const ag = agent('worker')
      .model('sonnet')
      .rules(rule => [
        rule.noCode()
          .blocks('No code allowed'),
        rule.mustProgress('15m')
          .prompts('Keep working')
          .otherwise.escalates('human')
      ])
      .build();

    expect(ag.rules[0]?.type).toBe('noCode');
    expect(ag.rules[0]?.correction?.type).toBe('block');
    expect(ag.rules[0]?.correction?.message).toBe('No code allowed');

    expect(ag.rules[1]?.type).toBe('mustProgress');
    expect(ag.rules[1]?.correction?.type).toBe('prompt');
    expect(ag.rules[1]?.correction?.then?.type).toBe('escalate');
    expect(ag.rules[1]?.correction?.then?.to).toBe('human');
  });

  it('supports all rule types', () => {
    const ag = agent('worker')
      .model('sonnet')
      .rules(rule => [
        rule.noCode(),
        rule.readOnly(),
        rule.mustProgress('10m'),
        rule.mustReport('markdown'),
        rule.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }),
        rule.fileScope(() => ['src/auth.ts']),
        rule.contextLimit({ max: 50000 }),
        rule.externalTodo({ file: 'TODO.md', checkBeforeStop: true })
      ])
      .build();

    expect(ag.rules).toHaveLength(8);
    expect(ag.rules.map(i => i.type)).toEqual([
      'noCode',
      'readOnly',
      'mustProgress',
      'mustReport',
      'tdd',
      'fileScope',
      'contextLimit',
      'externalTodo'
    ]);
  });

  it('chains from heartbeat builder', () => {
    const ag = agent('worker')
      .model('sonnet')
      .heartbeat('30s')
      .misses(1).prompts('Check in')
      .rules(rule => [rule.mustProgress('15m')])
      .build();

    expect(ag.heartbeat).toBeDefined();
    expect(ag.rules[0]?.type).toBe('mustProgress');
  });

  it('supports tdd rule with correction chain', () => {
    const ag = agent('worker')
      .model('sonnet')
      .rules(rule => [
        rule.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' })
          .prompts('Write tests first')
          .otherwise.restarts()
          .otherwise.escalates('human')
      ])
      .build();

    expect(ag.rules[0]?.type).toBe('tdd');
    expect(ag.rules[0]?.correction?.type).toBe('prompt');
    expect(ag.rules[0]?.correction?.then?.type).toBe('restart');
    expect(ag.rules[0]?.correction?.then?.then?.type).toBe('escalate');
  });
});
