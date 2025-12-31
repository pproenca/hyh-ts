// packages/dsl/src/builders/queue.ts
import { Duration, parseDuration } from '../types/primitives.js';
import { CompiledQueue } from '../types/compiled.js';
import { Task } from '../types/context.js';

export class QueueBuilder {
  private _name: string;
  private _readyPredicate: string = 'true';
  private _timeout: number = 600000; // 10 minutes default

  constructor(name: string) {
    this._name = name;
  }

  ready(predicate: (task: Task) => boolean): this {
    // Convert function to string representation for serialization
    const fnStr = predicate.toString();
    // Extract the expression (simplified - assumes arrow function)
    const match = fnStr.match(/=>\s*(.+)$/s);
    this._readyPredicate = match ? match[1]!.trim() : 'true';
    return this;
  }

  timeout(duration: Duration): this {
    this._timeout = parseDuration(duration);
    return this;
  }

  build(): CompiledQueue {
    return {
      name: this._name,
      readyPredicate: this._readyPredicate,
      timeout: this._timeout,
    };
  }
}

export function queue(name: string): QueueBuilder {
  return new QueueBuilder(name);
}
