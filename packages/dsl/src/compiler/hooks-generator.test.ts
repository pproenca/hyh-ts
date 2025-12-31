// packages/dsl/src/compiler/hooks-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateHooksJson } from './hooks-generator.js';
import { workflow, agent } from '../index.js';

describe('generateHooksJson', () => {
  it('generates hooks config with SessionStart and Stop', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks).toBeDefined();
    expect(hooks.hooks.SessionStart).toBeDefined();
    expect(hooks.hooks.Stop).toBeDefined();
  });

  it('generates PostToolUse hooks from agent config', () => {
    const coder = agent('coder')
      .model('sonnet')
      .role('implementer')
      .postToolUse({ matcher: 'Edit|Write', run: ['hyh lint --fix'] });

    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('code').agent(coder)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.PostToolUse).toBeDefined();
    expect(hooks.hooks.PostToolUse).toHaveLength(1);
    expect(hooks.hooks.PostToolUse![0].matcher).toBe('Edit|Write');
    expect(hooks.hooks.PostToolUse![0].hooks).toEqual([
      { type: 'command', command: 'hyh lint --fix' },
    ]);
  });

  it('generates SubagentStop hooks from agent config', () => {
    const reviewer = agent('reviewer')
      .model('sonnet')
      .role('reviewer')
      .subagentStop({ verify: ['hyh verify-review'] });

    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('review').agent(reviewer)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.SubagentStop).toBeDefined();
    expect(hooks.hooks.SubagentStop).toHaveLength(1);
    expect(hooks.hooks.SubagentStop![0].matcher).toBe('');
    expect(hooks.hooks.SubagentStop![0].hooks).toEqual([
      { type: 'command', command: 'hyh verify-review' },
    ]);
  });

  it('aggregates PostToolUse hooks from multiple agents', () => {
    const coder = agent('coder')
      .model('sonnet')
      .role('implementer')
      .postToolUse({ matcher: 'Edit|Write', run: ['hyh lint --fix'] });

    const tester = agent('tester')
      .model('sonnet')
      .role('tester')
      .postToolUse({ matcher: 'Bash', run: ['hyh check-tests'] });

    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('code').agent(coder)
      .phase('test').agent(tester)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.PostToolUse).toBeDefined();
    expect(hooks.hooks.PostToolUse).toHaveLength(2);
    expect(hooks.hooks.PostToolUse![0].matcher).toBe('Edit|Write');
    expect(hooks.hooks.PostToolUse![1].matcher).toBe('Bash');
  });
});

describe('hooks-generator PreCompact', () => {
  it('generates hooks object with correct structure', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    // SessionStart and Stop are always present
    expect(hooks.hooks).toHaveProperty('SessionStart');
    expect(hooks.hooks).toHaveProperty('Stop');
    // PostToolUse and SubagentStop are only present when configured
    expect(hooks).toHaveProperty('hooks');
  });
});

describe('hooks-generator SessionStart', () => {
  it('includes workflow status command in SessionStart', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.SessionStart).toBeDefined();
    expect(hooks.hooks.SessionStart).toHaveLength(1);
    expect(hooks.hooks.SessionStart![0].hooks[0].command).toContain('hyh status');
  });
});

describe('hooks-generator Stop hook', () => {
  it('includes verify-complete command in Stop', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.Stop).toBeDefined();
    expect(hooks.hooks.Stop![0].hooks[0].command).toContain('verify-complete');
  });

  it('sets timeout on Stop hook', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks.Stop![0].hooks[0].timeout).toBeDefined();
    expect(hooks.hooks.Stop![0].hooks[0].timeout).toBe(120);
  });
});
