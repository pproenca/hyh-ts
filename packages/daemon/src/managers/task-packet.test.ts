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
