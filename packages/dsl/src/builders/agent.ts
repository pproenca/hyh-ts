// packages/dsl/src/builders/agent.ts
import { Model, ToolSpec, parseDuration, Duration } from '../types/primitives.js';
import { CompiledAgent, CompiledInvariant, Correction } from '../types/compiled.js';

interface HeartbeatConfig {
  interval: number;
  corrections: Array<{ count: number; correction: Correction }>;
}

export class AgentBuilder {
  private _name: string;
  private _model: Model = 'sonnet';
  private _role: string = 'worker';
  private _tools: ToolSpec[] = [];
  private _spawns: string[] = [];
  private _invariants: CompiledInvariant[] = [];
  private _violations: Record<string, Correction[]> = {};
  private _heartbeat?: HeartbeatConfig;
  private _isReadOnly: boolean = false;

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

  invariants(...invariants: CompiledInvariant[]): this {
    this._invariants.push(...invariants);
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
    if ('after' in correctionOrOptions && maybeCorrection) {
      this._violations[type]!.push(maybeCorrection);
    } else {
      this._violations[type]!.push(correctionOrOptions as Correction);
    }
    return this;
  }

  build(): CompiledAgent {
    return {
      name: this._name,
      model: this._model,
      role: this._role,
      tools: this._tools,
      spawns: this._spawns,
      invariants: this._invariants,
      violations: this._violations,
      heartbeat: this._heartbeat,
    };
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
        correction: countOrCorrection as Correction,
      });
    }
    return this;
  }

  invariants(...invariants: CompiledInvariant[]): AgentBuilder {
    return this._parent.invariants(...invariants);
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
