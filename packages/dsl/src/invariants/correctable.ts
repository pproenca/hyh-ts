// packages/dsl/src/invariants/correctable.ts
import type { CompiledRule, Correction } from '../types/compiled.js';
import {
  createCorrectionVerbMixin,
  type ChainableCorrectionVerbs,
} from '../corrections/verbs.js';

/**
 * Base rule shape for CorrectableRule constructor.
 */
interface BaseRule {
  type: string;
  agentName?: string;
  options?: Record<string, unknown>;
}

/**
 * A rule with fluent correction verbs.
 * Can be compiled to a CompiledRule via the agent builder's build() method.
 */
export class CorrectableRule implements ChainableCorrectionVerbs<CorrectableRule> {
  readonly type: string;
  readonly agentName: string | undefined;
  readonly options: Record<string, unknown> | undefined;
  private _correction: Correction | undefined;

  private readonly verbs: ChainableCorrectionVerbs<CorrectableRule>;

  constructor(base: BaseRule) {
    this.type = base.type;
    this.agentName = base.agentName;
    this.options = base.options;

    this.verbs = createCorrectionVerbMixin<CorrectableRule>({
      getParent: () => this,
      getCorrection: () => this._correction,
      setCorrection: (c) => { this._correction = c; },
    });
  }

  /** Returns the correction chain if set */
  get correction(): Correction | undefined {
    return this._correction;
  }

  // Correction verb methods delegating to mixin
  blocks(message?: string): CorrectableRule {
    return this.verbs.blocks(message);
  }

  prompts(message: string): CorrectableRule {
    return this.verbs.prompts(message);
  }

  warns(message: string): CorrectableRule {
    return this.verbs.warns(message);
  }

  restarts(): CorrectableRule {
    return this.verbs.restarts();
  }

  reassigns(): CorrectableRule {
    return this.verbs.reassigns();
  }

  escalates(to: 'orchestrator' | 'human'): CorrectableRule {
    return this.verbs.escalates(to);
  }

  retries(opts: { max: number; backoff?: number }): CorrectableRule {
    return this.verbs.retries(opts);
  }

  compacts(opts: { preserve: string[] }): CorrectableRule {
    return this.verbs.compacts(opts);
  }

  uses(correction: Correction): CorrectableRule {
    return this.verbs.uses(correction);
  }

  get otherwise(): ChainableCorrectionVerbs<CorrectableRule>['otherwise'] {
    return this.verbs.otherwise;
  }
}

/**
 * Wraps a CompiledRule in a CorrectableRule for fluent correction chaining.
 */
export function correctable(rule: CompiledRule): CorrectableRule {
  return new CorrectableRule(rule);
}
