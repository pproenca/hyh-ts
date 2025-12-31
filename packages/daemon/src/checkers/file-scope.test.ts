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
