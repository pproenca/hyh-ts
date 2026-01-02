// packages/dsl/src/builders/agent.ts
import { Model, ToolSpec, parseDuration, Duration } from '../types/primitives.js';
import { CompiledAgent, CompiledRule, Correction } from '../types/compiled.js';
import { inv } from '../invariants/index.js';
import type { RuleBuilder } from '../types/context.js';

interface HeartbeatConfig {
  interval: number;
  corrections: Array<{ count: number; correction: Correction }>;
}

interface PostToolUseConfig {
  matcher: string;
  commands: string[];
}

interface SubagentStopConfig {
  verify: string[];
}

interface ReinjectConfig {
  every: number;
  content: string;
}

export class AgentBuilder {
  private _name: string;
  private _model: Model = 'sonnet';
  private _role: string = 'worker';
  private _tools: ToolSpec[] = [];
  private _spawns: string[] = [];
  private _rules: CompiledRule[] = [];
  private _violations: Record<string, Correction[]> = {};
  private _heartbeat?: HeartbeatConfig;
  private _isReadOnly: boolean = false;
  private _postToolUse?: PostToolUseConfig;
  private _subagentStop?: SubagentStopConfig;
  private _reinject?: ReinjectConfig;

  constructor(name: string) {
    this._name = name;
  }

  model(model: Model): this {
    this._model = model;
    return this;
  }

  role(role: string): this {
    this._role = role;
    return this;
  }

  tools(...tools: ToolSpec[]): this {
    this._tools.push(...tools);
    return this;
  }

  readOnly(): this {
    this._isReadOnly = true;
    // Filter out Write and Edit if they were added
    this._tools = this._tools.filter(
      (t) => typeof t !== 'string' || !['Write', 'Edit'].includes(t)
    );
    return this;
  }

  spawns(otherAgent: AgentBuilder): this {
    this._spawns.push(otherAgent._name);
    return this;
  }

  heartbeat(interval: Duration): HeartbeatBuilder {
    this._heartbeat = {
      interval: parseDuration(interval),
      corrections: [],
    };
    return new HeartbeatBuilder(this, this._heartbeat);
  }

  /**
   * Define agent rules using callback for IDE autocomplete
   * @example
   * agent('worker')
   *   .rules(rule => [
   *     rule.noCode(),
   *     rule.mustProgress('15m')
   *   ])
   */
  rules(factory: (rule: RuleBuilder) => CompiledRule[]): this {
    const ruleImpl: RuleBuilder = {
      tdd: inv.tdd,
      fileScope: inv.fileScope,
      noCode: inv.noCode,
      readOnly: inv.readOnly,
      mustReport: inv.mustReport,
      mustProgress: inv.mustProgress,
      externalTodo: inv.externalTodo,
      contextLimit: inv.contextLimit,
    };
    this._rules.push(...factory(ruleImpl));
    return this;
  }


  postToolUse(config: { matcher: string; run: string[] }): this {
    this._postToolUse = { matcher: config.matcher, commands: config.run };
    return this;
  }

  subagentStop(config: { verify: string[] }): this {
    this._subagentStop = { verify: config.verify };
    return this;
  }

  reinject(config: { every: number; content: string }): this {
    this._reinject = { every: config.every, content: config.content };
    return this;
  }

  onViolation(type: string, correction: Correction): this;
  onViolation(type: string, options: { after: number }, correction: Correction): this;
  onViolation(
    type: string,
    correctionOrOptions: Correction | { after: number },
    maybeCorrection?: Correction
  ): this {
    if (!this._violations[type]) {
      this._violations[type] = [];
    }
    const violations = this._violations[type];
    if ('after' in correctionOrOptions && maybeCorrection) {
      violations.push(maybeCorrection);
    } else {
      // Safe: type narrowing - 'after' not in correctionOrOptions means it's Correction
      violations.push(correctionOrOptions as Correction);
    }
    return this;
  }

  build(): CompiledAgent {
    const result: CompiledAgent = {
      name: this._name,
      model: this._model,
      role: this._role,
      tools: this._tools,
      spawns: this._spawns,
      rules: this._rules,
      violations: this._violations,
    };
    if (this._heartbeat) {
      result.heartbeat = this._heartbeat;
    }
    if (this._postToolUse) {
      result.postToolUse = this._postToolUse;
    }
    if (this._subagentStop) {
      result.subagentStop = this._subagentStop;
    }
    if (this._reinject) {
      result.reinject = this._reinject;
    }
    return result;
  }
}

class HeartbeatBuilder {
  constructor(
    private _parent: AgentBuilder,
    private _config: HeartbeatConfig
  ) {}

  onMiss(correction: Correction): this;
  onMiss(count: number, correction: Correction): this;
  onMiss(countOrCorrection: number | Correction, maybeCorrection?: Correction): this {
    if (typeof countOrCorrection === 'number' && maybeCorrection) {
      this._config.corrections.push({
        count: countOrCorrection,
        correction: maybeCorrection,
      });
    } else {
      this._config.corrections.push({
        count: 1,
        // Safe: type narrowing - if not number, must be Correction
        correction: countOrCorrection as Correction,
      });
    }
    return this;
  }

  rules(factory: (rule: RuleBuilder) => CompiledRule[]): AgentBuilder {
    return this._parent.rules(factory);
  }

  onViolation(type: string, correction: Correction): AgentBuilder {
    return this._parent.onViolation(type, correction);
  }

  build(): CompiledAgent {
    return this._parent.build();
  }
}

export function agent(name: string): AgentBuilder {
  return new AgentBuilder(name);
}
