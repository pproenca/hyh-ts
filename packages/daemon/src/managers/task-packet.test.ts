import { describe, it, expect, vi } from 'vitest';
import { TaskPacketFactory } from './task-packet.js';

describe('TaskPacketFactory', () => {
  it('should generate task packet with objective and constraints', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Implement login form',
      files: ['src/components/Login.tsx'],
      dependencies: [],
      interfaces: ['UserCredentials', 'AuthResponse'],
    });

    expect(packet.objective).toContain('Implement login form');
    expect(packet.constraints.fileScope).toContain('src/components/Login.tsx');
    expect(packet.context.interfaces).toContain('UserCredentials');
    expect(packet.doNot).toContain('modify files outside scope');
  });

  it('should load dependency artifacts into context', async () => {
    const mockArtifactManager = {
      loadForDependencies: vi.fn().mockResolvedValue({
        t0: { summary: 'Created auth types', exports: ['AuthToken'] },
      }),
    };
    const factory = new TaskPacketFactory({
      artifactManager: mockArtifactManager,
    });

    const packet = await factory.createAsync({
      taskId: 't1',
      description: 'Use auth types',
      files: ['src/api/auth.ts'],
      dependencies: ['t0'],
    });

    expect(packet.context.dependencyArtifacts).toHaveProperty('t0');
    expect(packet.context.dependencyArtifacts['t0'].exports).toContain(
      'AuthToken'
    );
  });

  it('should exclude specified context items', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Quick fix',
      files: ['src/fix.ts'],
      exclude: ['exploration', 'history'],
    });

    expect(packet.doNot).toContain('include exploration context');
    expect(packet.doNot).toContain('include history context');
  });
});

describe('TaskPacket schema', () => {
  it('should include all required fields', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Test task',
      files: ['src/test.ts'],
    });

    expect(packet).toHaveProperty('objective');
    expect(packet).toHaveProperty('constraints');
    expect(packet).toHaveProperty('context');
    expect(packet).toHaveProperty('doNot');
  });

  it('should include TDD constraint by default', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Test task',
      files: [],
    });

    expect(packet.constraints.tdd).toBe(true);
  });

  it('should generate interface contract in context', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Create user service',
      files: ['src/user.ts'],
      interfaces: ['User', 'UserService'],
    });

    expect(packet.context.interfaces).toContain('User');
    expect(packet.context.interfaces).toContain('UserService');
  });

  it('should include do-not list with scope restriction', () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Fix bug',
      files: ['src/bug.ts'],
    });

    expect(packet.doNot).toContain('modify files outside scope');
  });
});

describe('TaskPacket wave calculation', () => {
  it('should handle tasks without dependencies in wave 0', async () => {
    const factory = new TaskPacketFactory();
    const packet = factory.create({
      taskId: 't1',
      description: 'Independent task',
      files: ['src/a.ts'],
      dependencies: [],
    });

    // Tasks without dependencies have empty dependencyArtifacts
    expect(Object.keys(packet.context.dependencyArtifacts)).toHaveLength(0);
  });

  it('should load artifacts for dependencies in later waves', async () => {
    const mockArtifactManager = {
      loadForDependencies: vi.fn().mockResolvedValue({
        t0: { summary: 'First task done', exports: ['TypeA'] },
        t1: { summary: 'Second task done', exports: ['TypeB'] },
      }),
    };
    const factory = new TaskPacketFactory({
      artifactManager: mockArtifactManager,
    });

    const packet = await factory.createAsync({
      taskId: 't2',
      description: 'Depends on t0 and t1',
      files: ['src/combined.ts'],
      dependencies: ['t0', 't1'],
    });

    expect(packet.context.dependencyArtifacts).toHaveProperty('t0');
    expect(packet.context.dependencyArtifacts).toHaveProperty('t1');
  });
});
