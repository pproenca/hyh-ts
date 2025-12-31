// packages/daemon/src/core/event-loop.ts

export interface Daemon {
  checkSpawnTriggers(): Promise<SpawnTrigger[]>;
  spawnAgents(triggers: SpawnTrigger[]): Promise<void>;
  checkPhaseTransition(): Promise<boolean>;
  stateManager: { flush(): void };
  heartbeatMonitor: { getOverdueAgents(): unknown[] };
}

export interface SpawnTrigger {
  agentType: string;
  taskId: string;
}

export interface EventLoopOptions {
  tickInterval: number;
  onTick?: () => Promise<void> | void;
}

export class EventLoop {
  private readonly daemon: Daemon | null;
  private readonly options: EventLoopOptions;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;

  constructor(daemonOrOptions: Daemon | EventLoopOptions, options?: EventLoopOptions) {
    // Support both new signature (daemon, options) and legacy (options with onTick)
    if (options !== undefined) {
      this.daemon = daemonOrOptions as Daemon;
      this.options = options;
    } else if ('onTick' in daemonOrOptions) {
      this.daemon = null;
      this.options = daemonOrOptions as EventLoopOptions;
    } else {
      this.daemon = daemonOrOptions as Daemon;
      this.options = { tickInterval: 1000 };
    }
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  async tick(): Promise<void> {
    if (!this.daemon) {
      throw new Error('tick() requires daemon to be provided');
    }

    // 1. Check spawn triggers and spawn agents
    const triggers = await this.daemon.checkSpawnTriggers();
    if (triggers.length > 0) {
      await this.daemon.spawnAgents(triggers);
    }

    // 2. Check heartbeats (handle overdue agents)
    this.daemon.heartbeatMonitor.getOverdueAgents();

    // 3. Check phase transitions
    await this.daemon.checkPhaseTransition();

    // 4. Flush state
    this.daemon.stateManager.flush();
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
        if (this.daemon) {
          await this.tick();
        } else if (this.options.onTick) {
          await this.options.onTick();
        }
      } finally {
        this.scheduleTick();
      }
    }, this.options.tickInterval);
  }
}
