// packages/daemon/src/agents/output-parser.test.ts
import { describe, it, expect } from 'vitest';
import { ClaudeOutputParser, ClaudeEvent } from './output-parser.js';

describe('ClaudeOutputParser', () => {
  it('should parse tool_use events from stream-json', async () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();

    parser.on('data', (event) => events.push(event));

    // Simulate Claude output
    const lines = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"I will help"}]}}',
      '{"type":"tool_use","id":"123","name":"Read","input":{"path":"src/foo.ts"}}',
      '{"type":"tool_result","tool_use_id":"123","content":"file contents"}',
    ];

    for (const line of lines) {
      parser.write(line + '\n');
    }
    parser.end();

    expect(events).toHaveLength(3);
    expect(events[1]).toEqual({
      type: 'tool_use',
      id: '123',
      name: 'Read',
      input: { path: 'src/foo.ts' },
    });
  });

  it('should handle partial lines', async () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"tool_');
    parser.write('use","id":"1","name":"Write","input":{}}');
    parser.write('\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_use');
  });
});
