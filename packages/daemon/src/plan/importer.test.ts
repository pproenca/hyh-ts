// packages/daemon/src/plan/importer.test.ts
import { describe, it, expect } from 'vitest';
import { PlanImporter } from './importer.js';

describe('PlanImporter', () => {
  it('parses tasks.md format into task states', () => {
    const markdown = `
# Tasks

## Task 1: Setup
- Files: src/setup.ts
- Dependencies: none

## Task 2: Feature
- Files: src/feature.ts
- Dependencies: Task 1
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('task-1');
    expect(tasks[1].dependencies).toContain('task-1');
  });

  it('handles tasks with no dependencies', () => {
    const markdown = `
## Task 1: First task
- Files: src/first.ts
- Dependencies: none
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[0].dependencies).toHaveLength(0);
  });

  it('converts parsed tasks to task states', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-1', description: 'Setup', files: ['src/setup.ts'], dependencies: [] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-1']).toBeDefined();
    expect(states['task-1'].status).toBe('pending');
    expect(states['task-1'].description).toBe('Setup');
  });
});

describe('PlanImporter file parsing', () => {
  it('parses multiple files', () => {
    const markdown = `
## Task 1: Multi-file
- Files: src/a.ts, src/b.ts, src/c.ts
- Dependencies: none
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[0]!.files).toHaveLength(3);
    expect(tasks[0]!.files).toContain('src/a.ts');
    expect(tasks[0]!.files).toContain('src/b.ts');
    expect(tasks[0]!.files).toContain('src/c.ts');
  });

  it('handles missing files field', () => {
    const markdown = `
## Task 1: No files
- Dependencies: none
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[0]!.files).toHaveLength(0);
  });
});

describe('PlanImporter dependency parsing', () => {
  it('parses multiple dependencies', () => {
    const markdown = `
## Task 1: First
- Dependencies: none

## Task 2: Second
- Dependencies: none

## Task 3: Depends on both
- Dependencies: Task 1, Task 2
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[2]!.dependencies).toContain('task-1');
    expect(tasks[2]!.dependencies).toContain('task-2');
  });

  it('normalizes task references', () => {
    const markdown = `
## Task 1: Base
- Dependencies: none

## Task 2: Depends
- Dependencies: TASK 1
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[1]!.dependencies).toContain('task-1');
  });
});

describe('PlanImporter task state generation', () => {
  it('sets default timeout', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-1', description: 'Test', files: [], dependencies: [] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-1']!.timeoutSeconds).toBe(600);
  });

  it('sets attempts to 0', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-1', description: 'Test', files: [], dependencies: [] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-1']!.attempts).toBe(0);
  });

  it('preserves files in task state', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-1', description: 'Test', files: ['a.ts', 'b.ts'], dependencies: [] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-1']!.files).toEqual(['a.ts', 'b.ts']);
  });

  it('preserves dependencies in task state', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-2', description: 'Test', files: [], dependencies: ['task-1'] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-2']!.dependencies).toEqual(['task-1']);
  });
});
