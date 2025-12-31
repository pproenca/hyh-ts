// packages/dsl/src/builders/gate.ts
import { CompiledGate, Correction } from '../types/compiled.js';
import { Context } from '../types/context.js';

export class GateBuilder {
  private _name: string;
  private _requires: string[] = [];
  private _onFail?: Correction;
  private _onFailFinal?: Correction;

  constructor(name: string) {
    this._name = name;
  }

  requires(check: (ctx: Context) => Promise<boolean> | boolean): this {
    // Convert function to string representation
    const fnStr = check.toString();
    this._requires.push(fnStr);
    return this;
  }

  onFail(correction: Correction): this {
    this._onFail = correction;
    return this;
  }

  onFailFinal(correction: Correction): this {
    this._onFailFinal = correction;
    return this;
  }

  build(): CompiledGate {
    const result: CompiledGate = {
      name: this._name,
      requires: this._requires,
    };
    if (this._onFail) {
      result.onFail = this._onFail;
    }
    if (this._onFailFinal) {
      result.onFailFinal = this._onFailFinal;
    }
    return result;
  }
}

export function gate(name: string): GateBuilder {
  return new GateBuilder(name);
}
