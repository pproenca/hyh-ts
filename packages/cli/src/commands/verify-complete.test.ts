// packages/cli/src/commands/verify-complete.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('verify-complete command', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-verify-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true });
  });

  it('passes when no todo file exists', async () => {
    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete();
    expect(result.passed).toBe(true);
  });

  it('fails when todo has incomplete items', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '- [x] Done\n- [ ] Not done'
    );

    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete({ todoFile: 'todo.md' });

    expect(result.passed).toBe(false);
    expect(result.errors).toContain('1 incomplete todo items');
  });

  it('passes when all todos complete', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '- [x] Task 1\n- [x] Task 2'
    );

    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete({ todoFile: 'todo.md' });

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
