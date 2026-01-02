// packages/dsl/src/compiler/prompt-generator.ts
import { CompiledAgent } from '../types/compiled.js';

export function generateAgentPrompt(agent: CompiledAgent): string {
  const lines: string[] = [];

  lines.push(`# ${agent.name} Agent`);
  lines.push('');
  lines.push('## Identity');
  lines.push(`- **Role**: ${agent.role}`);
  lines.push(`- **Model**: ${agent.model}`);
  lines.push('');

  lines.push('## Workflow');
  lines.push('');
  lines.push('### Getting Work');
  lines.push('```bash');
  lines.push(`hyh task claim${agent.role ? ` --role ${agent.role}` : ''}`);
  lines.push('```');
  lines.push('You will receive a JSON task object with instructions.');
  lines.push('');

  if (agent.heartbeat) {
    const intervalSec = Math.round(agent.heartbeat.interval / 1000);
    lines.push('### Heartbeat');
    lines.push(`Run \`hyh heartbeat\` every ${intervalSec} seconds.`);
    lines.push('');
  }

  lines.push('### Completing Work');
  lines.push('```bash');
  lines.push('hyh task complete --id <task-id>');
  lines.push('```');
  lines.push('');

  if (agent.rules.length > 0) {
    lines.push('## Constraints');
    lines.push('');
    for (const inv of agent.rules) {
      lines.push(`### ${inv.type}`);
      lines.push(getInvariantDescription(inv.type, inv.options));
      lines.push('');
    }
  }

  lines.push('## Tools Available');
  for (const tool of agent.tools) {
    const toolName = typeof tool === 'string' ? tool : `${tool.tool}(${tool.pattern})`;
    lines.push(`- ${toolName}`);
  }
  lines.push('');

  return lines.join('\n');
}

function getInvariantDescription(type: string, options?: Record<string, unknown>): string {
  switch (type) {
    case 'tdd':
      return `You MUST write failing tests before implementation.\n- Test files: ${options?.test ?? '**/*.test.ts'}\n- Impl files: ${options?.impl ?? 'src/**/*.ts'}`;
    case 'fileScope':
      return 'You may ONLY modify files listed in your task scope.';
    case 'noCode':
      return 'You may NOT write or modify code files.';
    case 'readOnly':
      return 'You may NOT write or edit any files.';
    case 'mustProgress':
      return `You must show progress within ${Math.round((options?.timeout as number ?? 600000) / 60000)} minutes.`;
    default:
      return `Constraint: ${type}`;
  }
}
