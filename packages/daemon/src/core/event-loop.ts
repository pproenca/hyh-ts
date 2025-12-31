// packages/daemon/src/core/event-loop.ts
export interface EventLoopOptions {
  tickInterval: number;
  onTick: () => Promise<void> | void;
}

export class EventLoop {
  private readonly options: EventLoopOptions;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;

  constructor(options: EventLoopOptions) {
    this.options = options;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.scheduleTick();
  }

  stop(): void {
    this._isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleTick(): void {
    if (!this._isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.options.onTick();
      } finally {
        this.scheduleTick();
      }
    }, this.options.tickInterval);
  }
}
