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

  return hooks;
}
