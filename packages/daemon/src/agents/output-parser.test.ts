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
    expect(events[0]?.type).toBe('tool_use');
  });
});

describe('ClaudeOutputParser event types', () => {
  it('should parse assistant events', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('assistant');
    expect(events[0]?.message).toBeDefined();
  });

  it('should parse tool_result events', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"tool_result","tool_use_id":"abc","content":"result data"}\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('tool_result');
    expect(events[0]?.content).toBe('result data');
  });

  it('should parse result events', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"result","content":"final output"}\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('result');
  });

  it('should parse error events', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"error","message":"Something went wrong"}\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
  });
});

describe('ClaudeOutputParser raw output', () => {
  it('should emit raw events for non-JSON lines', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('This is not JSON\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('raw');
    expect(events[0]?.data).toBe('This is not JSON');
  });

  it('should handle trailing non-JSON data on flush', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"assistant"}\n');
    parser.write('trailing raw data');
    parser.end();

    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('raw');
  });

  it('should handle empty lines', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('\n\n{"type":"tool_use","id":"1","name":"Read","input":{}}\n\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('tool_use');
  });
});

describe('ClaudeOutputParser stream behavior', () => {
  it('should process multiple events in a single chunk', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    const multiLine = [
      '{"type":"assistant","message":"first"}',
      '{"type":"tool_use","id":"1","name":"Read","input":{}}',
      '{"type":"tool_result","content":"done"}',
    ].join('\n') + '\n';

    parser.write(multiLine);
    parser.end();

    expect(events).toHaveLength(3);
  });

  it('should extract tool input parameters', () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"tool_use","id":"123","name":"Write","input":{"file_path":"/foo.ts","content":"code"}}\n');
    parser.end();

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.name).toBe('Write');
    expect(event.input).toEqual({ file_path: '/foo.ts', content: 'code' });
  });
});
