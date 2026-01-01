// packages/dsl/src/builders/queue.ts
import { Duration, parseDuration } from '../types/primitives.js';
import { CompiledQueue, ExampleTask } from '../types/compiled.js';
import { Task } from '../types/context.js';

export class QueueBuilder {
  private _name: string;
  private _readyPredicate: string = 'true';
  private _donePredicate?: string;
  private _timeout: number = 600000; // 10 minutes default
  private _examples?: ExampleTask[];

  constructor(name: string) {
    this._name = name;
  }

  ready(predicate: (task: Task) => boolean): this {
    // Convert function to string representation for serialization
    const fnStr = predicate.toString();
    // Extract the expression (simplified - assumes arrow function)
    const match = fnStr.match(/=>\s*(.+)$/s);
    this._readyPredicate = match?.[1]?.trim() ?? 'true';
    return this;
  }

  done(predicate: (task: Task) => boolean): this {
    // Convert function to string representation for serialization
    const fnStr = predicate.toString();
    // Extract the expression (simplified - assumes arrow function)
    const match = fnStr.match(/=>\s*(.+)$/s);
    this._donePredicate = match?.[1]?.trim() ?? 'true';
    return this;
  }

  timeout(duration: Duration): this {
    this._timeout = parseDuration(duration);
    return this;
  }

  examples(...tasks: ExampleTask[]): this {
    this._examples = tasks;
    return this;
  }

  build(): CompiledQueue {
    const result: CompiledQueue = {
      name: this._name,
      readyPredicate: this._readyPredicate,
      timeout: this._timeout,
    };
    if (this._donePredicate) {
      result.donePredicate = this._donePredicate;
    }
    if (this._examples) {
      result.examples = this._examples;
    }
    return result;
  }
}

export function queue(name: string): QueueBuilder {
  return new QueueBuilder(name);
}
