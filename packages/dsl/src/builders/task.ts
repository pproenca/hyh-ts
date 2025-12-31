export interface TaskDefinition {
  id: string;
  description?: string;
  files: string[];
  dependencies: string[];
  instructions?: string;
  success?: string;
  wave?: number;
}

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
    return {
      id: this._id,
      description: this._description,
      files: this._files,
      dependencies: this._dependencies,
      instructions: this._instructions,
      success: this._success,
      wave: this._wave,
    };
  }
}

export function task(id: string): TaskBuilder {
  return new TaskBuilder(id);
}
