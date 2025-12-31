import { describe, it, expect } from 'vitest';
import { task } from './task.js';

describe('TaskBuilder', () => {
  it('creates task with id', () => {
    const t = task('setup');
    expect(t.build().id).toBe('setup');
  });

  it('sets files', () => {
    const t = task('setup').files('src/setup.ts', 'tests/setup.test.ts');
    expect(t.build().files).toEqual(['src/setup.ts', 'tests/setup.test.ts']);
  });

  it('sets dependencies', () => {
    const t = task('feature').depends('setup', 'config');
    expect(t.build().dependencies).toEqual(['setup', 'config']);
  });

  it('chains all options', () => {
    const t = task('auth')
      .files('src/auth.ts')
      .depends('setup')
      .instructions('Implement authentication')
      .success('All tests pass');

    const built = t.build();
    expect(built.id).toBe('auth');
    expect(built.files).toEqual(['src/auth.ts']);
    expect(built.dependencies).toEqual(['setup']);
    expect(built.instructions).toBe('Implement authentication');
    expect(built.success).toBe('All tests pass');
  });
});
