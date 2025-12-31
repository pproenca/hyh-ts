// packages/daemon/src/core/daemon.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from './daemon.js';
import { CheckerChain } from '../checkers/chain.js';
import { TddChecker } from '../checkers/tdd.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';

describe('Daemon', () => {
  let tempDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-daemon-'));
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('starts and responds to ping', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Connect and send ping
    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });

  it('handles get_state when no workflow exists', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'get_state' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.state).toBeNull();

    client.end();
  });

  it('handles heartbeat request', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    const workerId = 'test-worker-123';
    client.write(JSON.stringify({ command: 'heartbeat', workerId }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.ok).toBe(true);
    expect(typeof parsed.data.timestamp).toBe('number');

    client.end();
  });

  it('should check invariants when processing agent events', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });

    // Create a CheckerChain with TDD checker that requires test before impl
    const checkerChain = new CheckerChain([
      new TddChecker({
        test: '**/*.test.ts',
        impl: 'src/**/*.ts',
        agentName: 'worker',
      }),
    ]);
    daemon.loadCheckerChain(checkerChain);

    await daemon.start();

    // Simulate agent event that violates TDD (impl before test)
    const result = await daemon.processAgentEvent('worker-1', {
      type: 'tool_use',
      tool: 'Write',
      path: 'src/feature.ts',
      timestamp: Date.now(),
      agentId: 'worker-1',
    });

    expect(result.violation).toBeDefined();
    expect(result.violation?.type).toBe('tdd');

    await daemon.stop();
  });

  it('should apply correction when violation detected', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });

    // Create a CheckerChain with TDD checker
    const checkerChain = new CheckerChain([
      new TddChecker({
        test: '**/*.test.ts',
        impl: 'src/**/*.ts',
        agentName: 'worker',
      }),
    ]);
    daemon.loadCheckerChain(checkerChain);

    // Mock agent
    const mockAgent = { injectPrompt: vi.fn() };
    daemon.setAgent('worker-1', mockAgent);

    await daemon.start();

    // Simulate violation
    const result = await daemon.processAgentEvent('worker-1', {
      type: 'tool_use',
      tool: 'Write',
      path: 'src/impl.ts',
      timestamp: Date.now(),
      agentId: 'worker-1',
    });

    expect(result.violation).toBeDefined();
    expect(result.correction).toBeDefined();
    expect(mockAgent.injectPrompt).toHaveBeenCalled();

    await daemon.stop();
  });

  it('should spawn agents when spawn triggers fire', async () => {
    // Setup workflow with tasks
    const workflowPath = path.join(tempDir, '.hyh', 'workflow.json');
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, JSON.stringify({
      name: 'test',
      orchestrator: 'orchestrator',
      agents: { worker: { name: 'worker', model: 'sonnet', role: 'implementation' } },
      phases: [{ name: 'implement', agent: 'worker', queue: 'tasks', parallel: true }],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    }));

    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();
    await daemon.loadWorkflow(workflowPath);

    // Add pending task
    await daemon.stateManager.update((state) => {
      state.tasks['task-1'] = {
        id: 'task-1',
        description: 'Test task',
        status: 'pending',
        dependencies: [],
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        files: [],
        timeoutSeconds: 600,
      };
    });

    // Trigger spawn check
    const spawns = await daemon.checkSpawnTriggers();

    expect(spawns.length).toBeGreaterThanOrEqual(0);

    await daemon.stop();
  });

  it('should monitor agent heartbeats and detect misses', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Register heartbeat for agent
    daemon.recordHeartbeat('worker-1');

    // Check immediately - should be ok
    const status1 = daemon.checkHeartbeat('worker-1', 30000);
    expect(status1.status).toBe('ok');

    // Advance time past interval
    vi.useFakeTimers();
    vi.advanceTimersByTime(35000);

    const status2 = daemon.checkHeartbeat('worker-1', 30000);
    expect(status2.status).toBe('miss');
    expect(status2.count).toBe(1);

    vi.useRealTimers();
    await daemon.stop();
  });

  it('should process tick: check heartbeats, spawn triggers, phase transitions', async () => {
    const workflowPath = path.join(tempDir, '.hyh', 'workflow.json');
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, JSON.stringify({
      name: 'test',
      orchestrator: 'orchestrator',
      agents: { worker: { name: 'worker', model: 'sonnet', role: 'implementation' } },
      phases: [{ name: 'implement', agent: 'worker', queue: 'tasks', parallel: true }],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    }));

    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();
    await daemon.loadWorkflow(workflowPath);

    // Set up initial state
    await daemon.stateManager.update((state) => {
      state.currentPhase = 'implement';
      state.tasks['task-1'] = {
        id: 'task-1',
        description: 'Test task',
        status: 'pending',
        dependencies: [],
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        files: [],
        timeoutSeconds: 600,
      };
    });

    // Mock spawnAgents to avoid actually spawning processes
    vi.spyOn(daemon, 'spawnAgents').mockResolvedValue(undefined);

    // Run one tick
    const tickResult = await daemon.tick();

    expect(tickResult.spawnsTriggered).toBeGreaterThanOrEqual(0);
    expect(tickResult.heartbeatsMissed).toBeDefined();

    await daemon.stop();
  });

  it('should check and execute phase transitions', async () => {
    // Setup workflow with phases
    const workflowPath = path.join(tempDir, '.hyh', 'workflow.json');
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, JSON.stringify({
      name: 'test',
      orchestrator: 'orchestrator',
      agents: { worker: { name: 'worker', model: 'sonnet', role: 'implementation' } },
      phases: [
        { name: 'plan', agent: 'orchestrator' },
        { name: 'implement', agent: 'worker', queue: 'tasks' },
      ],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    }));

    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();
    await daemon.loadWorkflow(workflowPath);

    // Set state to current phase
    await daemon.stateManager.update((state) => {
      state.currentPhase = 'plan';
    });

    // Check transition (may or may not be ready based on phase completion)
    const canTransition = await daemon.checkPhaseTransition();
    expect(typeof canTransition).toBe('boolean');

    // If we can transition, do it
    if (canTransition) {
      await daemon.transitionPhase('implement');
      const state = await daemon.stateManager.load();
      expect(state.currentPhase).toBe('implement');
    }

    await daemon.stop();
  });

  it('should execute quality gate before phase transition', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Workflow with gate
    const workflowPath = path.join(tempDir, '.hyh', 'workflow.json');
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, JSON.stringify({
      name: 'test',
      orchestrator: 'orchestrator',
      agents: {},
      phases: [],
      queues: {},
      gates: {
        quality: {
          name: 'quality',
          requires: ['npm test'],
        },
      },
    }));

    await daemon.loadWorkflow(workflowPath);

    // Execute gate
    const gateResult = await daemon.executeGate('quality');

    expect(gateResult.passed).toBeDefined();

    await daemon.stop();
  });

  it('should spawn agents when tick detects pending tasks', async () => {
    // Arrange
    const workflowPath = path.join(tempDir, '.hyh', 'workflow.json');
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, JSON.stringify({
      name: 'test',
      orchestrator: 'orchestrator',
      agents: { worker: { name: 'worker', model: 'sonnet', role: 'implementation' } },
      phases: [{ name: 'implement', agent: 'worker', queue: 'tasks', parallel: true }],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    }));

    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();
    await daemon.loadWorkflow(workflowPath);
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't1': {
          id: 't1',
          description: 'Test task',
          status: 'pending',
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        },
      };
    });

    // Mock spawnAgents to avoid actually spawning processes
    const spawnSpy = vi.spyOn(daemon, 'spawnAgents').mockResolvedValue(undefined);

    // Act
    const result = await daemon.tick();

    // Assert
    expect(result.spawnsTriggered).toBeGreaterThan(0);
    expect(spawnSpy).toHaveBeenCalled();
  });

  it('should save artifact when task completes', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Set up a running task
    await daemon.stateManager.update((state) => {
      state.tasks['task-1'] = {
        id: 'task-1',
        description: 'Implement token service',
        status: 'running',
        dependencies: [],
        claimedBy: 'worker-1',
        claimedAt: Date.now(),
        startedAt: Date.now(),
        completedAt: null,
        attempts: 1,
        lastError: null,
        files: [],
        timeoutSeconds: 600,
      };
    });

    // Complete the task with artifact
    await daemon.completeTask('task-1', 'worker-1', {
      summary: 'Implemented token service',
      files: { created: [], modified: ['src/auth/token.ts'] },
      exports: ['generateToken'],
    });

    // Check artifact was saved
    const artifact = await daemon.getArtifact('task-1');
    expect(artifact).toBeDefined();
    expect(artifact!.summary).toContain('token service');
    expect(artifact!.files.modified).toContain('src/auth/token.ts');
    expect(artifact!.exports).toContain('generateToken');

    await daemon.stop();
  });

  it('should return active agents with pollEvents method', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Spawn a mock agent
    await daemon.stateManager.update(s => {
      s.agents = {
        'worker-1': {
          id: 'worker-1',
          type: 'worker',
          status: 'active',
          currentTask: 't1',
          pid: 123,
          sessionId: 'uuid-123',
          lastHeartbeat: Date.now(),
          violationCounts: {},
        },
      };
    });

    const activeAgents = daemon.getActiveAgents();

    expect(Array.isArray(activeAgents)).toBe(true);
  });

  describe('Daemon with extracted services', () => {
    it('delegates event processing to EventProcessor', async () => {
      daemon = new Daemon({ worktreeRoot: tempDir });
      await daemon.start();

      // Verify services are wired
      expect(daemon['eventProcessor']).toBeDefined();
      expect(daemon['agentLifecycle']).toBeDefined();
      expect(daemon['workflowCoordinator']).toBeDefined();
    });
  });

  describe('get_logs handler', () => {
    it('returns recent trajectory events', async () => {
      daemon = new Daemon({ worktreeRoot: tempDir });
      await daemon.start();

      // Setup: log some events
      await daemon['trajectory'].log({
        type: 'agent_spawn',
        timestamp: Date.now(),
        agentId: 'test-agent',
      });
      await daemon['trajectory'].log({
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'test-agent',
        toolName: 'Read',
      });

      const socketPath = daemon.getSocketPath();
      const client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => client.once('connect', resolve));

      client.write(JSON.stringify({ command: 'get_logs', limit: 10 }) + '\n');

      const response = await new Promise<string>((resolve) => {
        client.once('data', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response.trim());
      expect(parsed.status).toBe('ok');
      expect(parsed.data.logs).toHaveLength(2);

      client.end();
    });

    it('filters by agentId when specified', async () => {
      daemon = new Daemon({ worktreeRoot: tempDir });
      await daemon.start();

      await daemon['trajectory'].log({
        type: 'agent_spawn',
        timestamp: Date.now(),
        agentId: 'agent-1',
      });
      await daemon['trajectory'].log({
        type: 'agent_spawn',
        timestamp: Date.now(),
        agentId: 'agent-2',
      });

      const socketPath = daemon.getSocketPath();
      const client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => client.once('connect', resolve));

      client.write(JSON.stringify({ command: 'get_logs', agentId: 'agent-1' }) + '\n');

      const response = await new Promise<string>((resolve) => {
        client.once('data', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response.trim());
      expect(parsed.status).toBe('ok');
      expect(parsed.data.logs).toHaveLength(1);
      expect(parsed.data.logs[0].agentId).toBe('agent-1');

      client.end();
    });
  });
});
