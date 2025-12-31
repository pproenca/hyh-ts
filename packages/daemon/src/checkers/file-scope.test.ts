// packages/daemon/src/checkers/file-scope.test.ts
import { describe, it, expect } from 'vitest';
import { FileScopeChecker } from './file-scope.js';

describe('FileScopeChecker', () => {
  it('allows writes to files in scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts', 'tests/auth/token.test.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).toBeNull();
  });

  it('blocks writes to files outside scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/other/file.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('fileScope');
  });
});

describe('FileScopeChecker Edit tool', () => {
  it('blocks Edit to files outside scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Edit',
      path: 'src/other/file.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('fileScope');
  });

  it('allows Edit to files in scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Edit',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).toBeNull();
  });
});

describe('FileScopeChecker appliesTo', () => {
  it('applies to agents matching configured name', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/file.ts'],
    });

    expect(checker.appliesTo('worker-1', {})).toBe(true);
    expect(checker.appliesTo('worker-abc', {})).toBe(true);
  });

  it('does not apply to agents not matching configured name', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/file.ts'],
    });

    expect(checker.appliesTo('orchestrator', {})).toBe(false);
    expect(checker.appliesTo('other', {})).toBe(false);
  });
});

describe('FileScopeChecker ignores non-write tools', () => {
  it('ignores Read tool', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Read',
      path: 'src/other/file.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).toBeNull();
  });

  it('ignores Grep tool', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: [],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Grep',
      path: 'src/',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).toBeNull();
  });
});

describe('FileScopeChecker violation message', () => {
  it('includes the blocked file path in violation message', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/other/secret.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result).not.toBeNull();
    expect(result!.message).toContain('src/other/secret.ts');
  });

  it('includes correction with block type', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: [],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'any/file.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {},
    });

    expect(result!.correction).toBeDefined();
    expect(result!.correction!.type).toBe('block');
  });
});
