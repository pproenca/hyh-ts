import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactManager, Artifact } from './artifact.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ArtifactManager', () => {
  let tempDir: string;
  let manager: ArtifactManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-artifact-'));
    manager = new ArtifactManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('saves artifact as markdown file', async () => {
      const artifact: Artifact = {
        taskId: 'task-1',
        status: 'completed',
        summary: 'Implemented user authentication',
        files: {
          created: ['src/auth/login.ts', 'src/auth/logout.ts'],
          modified: ['src/index.ts'],
        },
        exports: ['AuthService', 'LoginHandler'],
        tests: {
          passed: 5,
          failed: 0,
          command: 'pnpm test -- src/auth',
        },
        notes: 'Used JWT for token management',
      };

      await manager.save(artifact);

      const filePath = path.join(tempDir, 'task-1.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('# Task: task-1');
      expect(content).toContain('**Status:** completed');
      expect(content).toContain('Implemented user authentication');
      expect(content).toContain('src/auth/login.ts');
      expect(content).toContain('src/auth/logout.ts');
      expect(content).toContain('src/index.ts');
      expect(content).toContain('AuthService');
      expect(content).toContain('LoginHandler');
      expect(content).toContain('Passed: 5');
      expect(content).toContain('Failed: 0');
      expect(content).toContain('JWT for token management');
    });
  });

  describe('load', () => {
    it('loads artifact by task ID', async () => {
      const artifact: Artifact = {
        taskId: 'task-2',
        status: 'completed',
        summary: 'Added database migrations',
        files: {
          created: ['migrations/001_users.sql'],
          modified: [],
        },
        exports: ['runMigrations'],
        tests: {
          passed: 3,
          failed: 0,
          command: 'pnpm test -- migrations',
        },
        notes: 'Schema ready for production',
      };

      await manager.save(artifact);
      const loaded = await manager.load('task-2');

      expect(loaded).not.toBeNull();
      expect(loaded!.taskId).toBe('task-2');
      expect(loaded!.status).toBe('completed');
      expect(loaded!.summary).toBe('Added database migrations');
      expect(loaded!.files.created).toContain('migrations/001_users.sql');
      expect(loaded!.exports).toContain('runMigrations');
      expect(loaded!.tests.passed).toBe(3);
      expect(loaded!.notes).toBe('Schema ready for production');
    });

    it('returns null for nonexistent artifact', async () => {
      const loaded = await manager.load('nonexistent-task');
      expect(loaded).toBeNull();
    });
  });

  describe('loadForDependencies', () => {
    it('loads interface info for dependent tasks', async () => {
      const artifact1: Artifact = {
        taskId: 'dep-1',
        status: 'completed',
        summary: 'Created auth module',
        files: {
          created: ['src/auth.ts'],
          modified: [],
        },
        exports: ['AuthService', 'AuthConfig'],
        tests: { passed: 2, failed: 0, command: 'pnpm test' },
        notes: '',
      };

      const artifact2: Artifact = {
        taskId: 'dep-2',
        status: 'completed',
        summary: 'Created database layer',
        files: {
          created: ['src/db.ts'],
          modified: [],
        },
        exports: ['Database', 'QueryBuilder'],
        tests: { passed: 4, failed: 0, command: 'pnpm test' },
        notes: '',
      };

      await manager.save(artifact1);
      await manager.save(artifact2);

      const dependencies = await manager.loadForDependencies(['dep-1', 'dep-2']);

      expect(dependencies).toHaveLength(2);
      expect(dependencies[0]!.taskId).toBe('dep-1');
      expect(dependencies[0]!.exports).toContain('AuthService');
      expect(dependencies[1]!.taskId).toBe('dep-2');
      expect(dependencies[1]!.exports).toContain('Database');
    });

    it('skips nonexistent dependencies', async () => {
      const artifact: Artifact = {
        taskId: 'exists',
        status: 'completed',
        summary: 'Existing task',
        files: { created: [], modified: [] },
        exports: ['Something'],
        tests: { passed: 1, failed: 0, command: 'pnpm test' },
        notes: '',
      };

      await manager.save(artifact);

      const dependencies = await manager.loadForDependencies(['exists', 'missing']);

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]!.taskId).toBe('exists');
    });
  });
});
