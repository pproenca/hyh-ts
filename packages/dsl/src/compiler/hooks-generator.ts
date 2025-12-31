// packages/dsl/src/compiler/hooks-generator.ts
import { CompiledWorkflow } from '../types/compiled.js';

interface HookEntry {
  type: 'command';
  command: string;
  timeout?: number;
}

interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

interface HooksConfig {
  hooks: {
    SessionStart?: HookMatcher[];
    Stop?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    SubagentStop?: HookMatcher[];
    PreCompact?: HookMatcher[];
  };
}

export function generateHooksJson(workflow: CompiledWorkflow): HooksConfig {
  const hooks: HooksConfig = {
    hooks: {},
  };

  // SessionStart hook - show workflow status
  hooks.hooks.SessionStart = [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'hyh status --quiet',
    }],
  }];

  // Stop hook - verify completion
  hooks.hooks.Stop = [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'hyh verify-complete',
      timeout: 120,
    }],
  }];

  // Collect PostToolUse hooks from agents
  const postToolUseHooks: HookMatcher[] = [];
  for (const agent of Object.values(workflow.agents)) {
    if (agent.postToolUse) {
      postToolUseHooks.push({
        matcher: agent.postToolUse.matcher,
        hooks: agent.postToolUse.commands.map((command) => ({
          type: 'command' as const,
          command,
        })),
      });
    }
  }
  if (postToolUseHooks.length > 0) {
    hooks.hooks.PostToolUse = postToolUseHooks;
  }

  // Collect SubagentStop hooks from agents
  const subagentStopHooks: HookMatcher[] = [];
  for (const agent of Object.values(workflow.agents)) {
    if (agent.subagentStop) {
      subagentStopHooks.push({
        matcher: '',
        hooks: agent.subagentStop.verify.map((command) => ({
          type: 'command' as const,
          command,
        })),
      });
    }
  }
  if (subagentStopHooks.length > 0) {
    hooks.hooks.SubagentStop = subagentStopHooks;
  }

  return hooks;
}
