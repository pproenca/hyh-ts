// packages/dsl/src/builders/agent.ts
import { Model, ToolSpec, parseDuration, Duration } from '../types/primitives.js';
import { CompiledAgent, CompiledRule, Correction } from '../types/compiled.js';
import { inv, CorrectableRule } from '../invariants/index.js';
import type { RuleBuilder } from '../types/context.js';
import {
  createCorrectionVerbMixin,
  type ChainableCorrectionVerbs,
  type CorrectionVerbs,
} from '../corrections/verbs.js';

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
  private readonly _name: string;
  private _model: Model = 'sonnet';
  private _role: string = 'worker';
  private _tools: ToolSpec[] = [];
  private _spawns: string[] = [];
  private _rules: CorrectableRule[] = [];
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
   * Define agent rules using callback for IDE autocomplete.
   * Each rule can chain correction verbs directly.
   * @example
   * agent('worker').rules(rule => [
   *   rule.noCode()
   *     .blocks('No code allowed'),
   *   rule.mustProgress('15m')
   *     .prompts('Keep working')
   *     .otherwise.escalates('human')
   * ])
   */
  rules(factory: (rule: RuleBuilder) => CorrectableRule[]): this {
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

  build(): CompiledAgent {
    // Compile CorrectableRules to CompiledRules
    const compiledRules: CompiledRule[] = this._rules.map((rule) => {
      const compiled: CompiledRule = {
        type: rule.type,
      };
      if (rule.agentName) {
        compiled.agentName = rule.agentName;
      }
      if (rule.options) {
        compiled.options = rule.options;
      }
      if (rule.correction) {
        compiled.correction = rule.correction;
      }
      return compiled;
    });

    const result: CompiledAgent = {
      name: this._name,
      model: this._model,
      role: this._role,
      tools: this._tools,
      spawns: this._spawns,
      rules: compiledRules,
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

/**
 * Builder for heartbeat corrections using fluent .misses(n).verb() pattern.
 */
class HeartbeatBuilder {
  constructor(
    private readonly _parent: AgentBuilder,
    private readonly _config: HeartbeatConfig
  ) {}

  /**
   * Define what happens after N missed heartbeats.
   * @example
   * .heartbeat('5m')
   *   .misses(1).prompts('Check in please')
   *   .misses(2).warns('Second warning')
   *   .misses(3).restarts()
   */
  misses(count: number): HeartbeatCorrectionBuilder {
    return new HeartbeatCorrectionBuilder(this, this._config, count);
  }

  rules(factory: (rule: RuleBuilder) => CorrectableRule[]): AgentBuilder {
    return this._parent.rules(factory);
  }

  build(): CompiledAgent {
    return this._parent.build();
  }
}

/**
 * Correction verb builder for heartbeat misses.
 * Returns to HeartbeatBuilder after each correction for chaining.
 */
class HeartbeatCorrectionBuilder implements CorrectionVerbs<HeartbeatBuilder> {
  private _correction?: Correction;
  private readonly verbs: ChainableCorrectionVerbs<HeartbeatBuilder>;

  constructor(
    private readonly _parent: HeartbeatBuilder,
    private readonly _config: HeartbeatConfig,
    private readonly _count: number
  ) {
    this.verbs = createCorrectionVerbMixin<HeartbeatBuilder>({
      getParent: () => this.finalize(),
      getCorrection: () => this._correction,
      setCorrection: (c) => { this._correction = c; },
    });
  }

  private finalize(): HeartbeatBuilder {
    if (this._correction) {
      this._config.corrections.push({
        count: this._count,
        correction: this._correction,
      });
    }
    return this._parent;
  }

  blocks(message?: string): HeartbeatBuilder {
    return this.verbs.blocks(message);
  }

  prompts(message: string): HeartbeatBuilder {
    return this.verbs.prompts(message);
  }

  warns(message: string): HeartbeatBuilder {
    return this.verbs.warns(message);
  }

  restarts(): HeartbeatBuilder {
    return this.verbs.restarts();
  }

  reassigns(): HeartbeatBuilder {
    return this.verbs.reassigns();
  }

  escalates(to: 'orchestrator' | 'human'): HeartbeatBuilder {
    return this.verbs.escalates(to);
  }

  retries(opts: { max: number; backoff?: number }): HeartbeatBuilder {
    return this.verbs.retries(opts);
  }

  compacts(opts: { preserve: string[] }): HeartbeatBuilder {
    return this.verbs.compacts(opts);
  }

  uses(correction: Correction): HeartbeatBuilder {
    return this.verbs.uses(correction);
  }
}

export function agent(name: string): AgentBuilder {
  return new AgentBuilder(name);
}
