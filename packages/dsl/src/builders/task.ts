import { TaskDefinition } from '../types/compiled.js';
export type { TaskDefinition } from '../types/compiled.js';

export class TaskBuilder {
  private _id: string;
  private _description?: string;
  private _files: string[] = [];
  private _dependencies: string[] = [];
  private _instructions?: string;
  private _success?: string;
  private _wave?: number;

  constructor(id: string) {
    this._id = id;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  files(...paths: string[]): this {
    this._files.push(...paths);
    return this;
  }

  depends(...taskIds: string[]): this {
    this._dependencies.push(...taskIds);
    return this;
  }

  instructions(text: string): this {
    this._instructions = text;
    return this;
  }

  success(criteria: string): this {
    this._success = criteria;
    return this;
  }

  wave(waveNumber: number): this {
    this._wave = waveNumber;
    return this;
  }

  build(): TaskDefinition {
    const result: TaskDefinition = {
      id: this._id,
      files: this._files,
      dependencies: this._dependencies,
    };
    if (this._description) {
      result.description = this._description;
    }
    if (this._instructions) {
      result.instructions = this._instructions;
    }
    if (this._success) {
      result.success = this._success;
    }
    if (this._wave !== undefined) {
      result.wave = this._wave;
    }
    return result;
  }
}

export function task(id: string): TaskBuilder {
  return new TaskBuilder(id);
}
