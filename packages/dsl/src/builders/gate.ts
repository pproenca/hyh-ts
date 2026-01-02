// packages/dsl/src/builders/gate.ts
import { CompiledGate, CompiledCheck, Correction } from '../types/compiled.js';
import type { Context } from '../types/context.js';
import {
  createCorrectionVerbMixin,
  type ChainableCorrectionVerbs,
  type CorrectionVerbs,
} from '../corrections/verbs.js';

/**
 * Builder for gates with per-check corrections.
 * Each .requires() returns a CheckBuilder that can chain correction verbs.
 */
export class GateBuilder {
  private readonly _name: string;
  private readonly _checks: CompiledCheck[] = [];
  private _currentCheck?: CheckBuilder;

  constructor(name: string) {
    this._name = name;
  }

  /**
   * Add a check requirement with optional correction chain.
   * @example
   * gate('quality')
   *   .requires(ctx => ctx.exec('pnpm test'))
   *     .retries({ max: 3 })
   *     .otherwise.escalates('human')
   *   .requires(ctx => ctx.exec('pnpm lint'))
   *     .retries({ max: 1 })
   *     .otherwise.blocks('Lint must pass')
   */
  requires(check: (ctx: Context) => Promise<boolean> | boolean): CheckBuilder {
    // Save previous check if exists
    if (this._currentCheck) {
      this._checks.push(this._currentCheck.compile());
    }
    this._currentCheck = new CheckBuilder(this, check);
    return this._currentCheck;
  }

  build(): CompiledGate {
    // Save final check if exists
    if (this._currentCheck) {
      this._checks.push(this._currentCheck.compile());
    }
    return {
      name: this._name,
      checks: this._checks,
    };
  }
}

/**
 * Builder for individual gate checks with correction verbs.
 */
export class CheckBuilder implements CorrectionVerbs<CheckBuilder> {
  private readonly _predicate: string;
  private _correction?: Correction;
  private readonly verbs: ChainableCorrectionVerbs<CheckBuilder>;

  constructor(
    private readonly _gate: GateBuilder,
    check: (ctx: Context) => Promise<boolean> | boolean
  ) {
    this._predicate = check.toString();
    this.verbs = createCorrectionVerbMixin<CheckBuilder>({
      getParent: () => this,
      getCorrection: () => this._correction,
      setCorrection: (c) => { this._correction = c; },
    });
  }

  /** Compile to a CompiledCheck */
  compile(): CompiledCheck {
    const result: CompiledCheck = {
      predicate: this._predicate,
    };
    if (this._correction) {
      result.correction = this._correction;
    }
    return result;
  }

  // Chain back to gate for next check
  requires(check: (ctx: Context) => Promise<boolean> | boolean): CheckBuilder {
    return this._gate.requires(check);
  }

  build(): CompiledGate {
    return this._gate.build();
  }

  // Correction verb methods
  blocks(message?: string): CheckBuilder {
    return this.verbs.blocks(message);
  }

  prompts(message: string): CheckBuilder {
    return this.verbs.prompts(message);
  }

  warns(message: string): CheckBuilder {
    return this.verbs.warns(message);
  }

  restarts(): CheckBuilder {
    return this.verbs.restarts();
  }

  reassigns(): CheckBuilder {
    return this.verbs.reassigns();
  }

  escalates(to: 'orchestrator' | 'human'): CheckBuilder {
    return this.verbs.escalates(to);
  }

  retries(opts: { max: number; backoff?: number }): CheckBuilder {
    return this.verbs.retries(opts);
  }

  compacts(opts: { preserve: string[] }): CheckBuilder {
    return this.verbs.compacts(opts);
  }

  uses(correction: Correction): CheckBuilder {
    return this.verbs.uses(correction);
  }

  get otherwise(): CorrectionVerbs<CheckBuilder> {
    return this.verbs.otherwise;
  }
}

export function gate(name: string): GateBuilder {
  return new GateBuilder(name);
}
