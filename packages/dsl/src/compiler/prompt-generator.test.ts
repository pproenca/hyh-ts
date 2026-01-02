// packages/dsl/src/compiler/prompt-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateAgentPrompt } from './prompt-generator.js';
import { agent } from '../index.js';

describe('generateAgentPrompt', () => {
  it('generates markdown prompt for agent', () => {
    const worker = agent('worker')
      .model('sonnet')
      .role('implementation')
      .tools('Read', 'Write', 'Edit', 'Bash(npm:*)')
      .rules(rule => [
        rule.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }),
        rule.fileScope(ctx => ctx.task.files)
      ])
      .build();

    const prompt = generateAgentPrompt(worker);

    expect(prompt).toContain('# worker Agent');
    expect(prompt).toContain('**Role**: implementation');
    expect(prompt).toContain('**Model**: sonnet');
    expect(prompt).toContain('hyh task claim');
    expect(prompt).toContain('tdd');
  });
});
