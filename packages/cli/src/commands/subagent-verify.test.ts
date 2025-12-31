// packages/cli/src/commands/subagent-verify.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('subagent-verify command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-subagent-verify-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should fail if todo.md has incomplete items', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '# Todo\n- [ ] Incomplete item\n- [x] Done item'
    );

    const { subagentVerify } = await import('./subagent-verify.js');
    const result = await subagentVerify({ cwd: tmpDir });

    expect(result.passed).toBe(false);
    expect(result.errors).toContain('1 incomplete todo item(s)');
  });

  it('should pass if all todo items complete', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '# Todo\n- [x] Done item 1\n- [x] Done item 2'
    );

    const { subagentVerify } = await import('./subagent-verify.js');
    const result = await subagentVerify({ cwd: tmpDir });

    expect(result.passed).toBe(true);
  });

  it('should run tests if --tests flag provided', async () => {
    await fs.writeFile(path.join(tmpDir, 'todo.md'), '# Todo\n- [x] Done');
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'echo "tests pass"' } })
    );

    const { subagentVerify } = await import('./subagent-verify.js');
    const result = await subagentVerify({ cwd: tmpDir, tests: true });

    expect(result.passed).toBe(true);
    expect(result.checks).toContain('tests');
  });
});
