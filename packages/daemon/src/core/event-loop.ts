// packages/daemon/src/core/event-loop.ts

export interface Daemon {
  checkSpawnTriggers(): Promise<SpawnTrigger[]>;
  spawnAgents(triggers: SpawnTrigger[]): Promise<void>;
  checkPhaseTransition(): Promise<boolean>;
  stateManager: { flush(): void };
  checkHeartbeats?(): string[];
  getActiveAgents?(): { agentId: string; pollEvents(): unknown[] }[];
  processAgentEvent?(agentId: string, event: unknown): Promise<unknown>;
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
  private running = false;

  constructor(daemonOrOptions: Daemon | EventLoopOptions, options?: EventLoopOptions) {
    // Support both new signature (daemon, options) and legacy (options with onTick)
    // Type assertions are safe due to the discriminated checks above each branch
    if (options !== undefined) {
      // When options is provided as second arg, first arg must be Daemon
      this.daemon = daemonOrOptions as Daemon;
      this.options = options;
    } else if ('onTick' in daemonOrOptions) {
      // Has onTick property, so it's EventLoopOptions (legacy signature)
      this.daemon = null;
      this.options = daemonOrOptions as EventLoopOptions;
    } else {
      // No options and no onTick, so it's a Daemon with default options
      this.daemon = daemonOrOptions as Daemon;
      this.options = { tickInterval: 1000 };
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  async tick(): Promise<void> {
    if (!this.daemon) {
      throw new Error('tick() requires daemon to be provided');
    }

    // 0. Poll active agents for events
    if (this.daemon.getActiveAgents && this.daemon.processAgentEvent) {
      const agents = this.daemon.getActiveAgents();
      for (const agent of agents) {
        const events = agent.pollEvents();
        for (const event of events) {
          await this.daemon.processAgentEvent(agent.agentId, event);
        }
      }
    }

    // 1. Check spawn triggers and spawn agents
    const triggers = await this.daemon.checkSpawnTriggers();
    if (triggers.length > 0) {
      await this.daemon.spawnAgents(triggers);
    }

    // 2. Check heartbeats (handle overdue agents)
    this.daemon.checkHeartbeats?.();

    // 3. Check phase transitions
    await this.daemon.checkPhaseTransition();

    // 4. Flush state
    this.daemon.stateManager.flush();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleTick(): void {
    if (!this.running) {
      return;
    }
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
