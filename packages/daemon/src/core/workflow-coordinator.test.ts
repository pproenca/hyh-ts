// packages/daemon/src/core/workflow-coordinator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowCoordinator } from './workflow-coordinator.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('WorkflowCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads workflow from file', async () => {
    const { readFile } = await import('node:fs/promises');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      name: 'test-workflow',
      phases: [{ name: 'phase-1' }],
      orchestrator: 'orch',
      agents: {},
      gates: {},
      queues: {},
    }));

    const mockUpdate = vi.fn();
    const coordinator = new WorkflowCoordinator({
      stateManager: { update: mockUpdate } as any,
      trajectory: { log: vi.fn() } as any,
    });

    await coordinator.load('/tmp/workflow.json');

    expect(coordinator.getWorkflow()).toBeDefined();
    expect(coordinator.getWorkflow()?.name).toBe('test-workflow');
  });

  it('checks phase transition conditions', async () => {
    const coordinator = new WorkflowCoordinator({
      stateManager: {
        load: vi.fn().mockResolvedValue({ currentPhase: 'phase-1', tasks: {} }),
        update: vi.fn(),
      } as any,
      trajectory: { log: vi.fn() } as any,
    });

    // Set up workflow manually
    coordinator['workflow'] = {
      name: 'test',
      phases: [{ name: 'phase-1' }, { name: 'phase-2' }],
      orchestrator: 'orch',
      agents: {},
      gates: {},
      queues: {},
    } as any;
    coordinator['phaseManager'] = {
      getNextPhase: vi.fn().mockReturnValue('phase-2'),
      canTransition: vi.fn().mockReturnValue(false),
    } as any;

    const shouldTransition = await coordinator.checkPhaseTransition();
    expect(typeof shouldTransition).toBe('boolean');
  });

  it('checks spawn triggers and returns spawn specs', async () => {
    const coordinator = new WorkflowCoordinator({
      stateManager: {
        load: vi.fn().mockResolvedValue({
          currentPhase: 'implement',
          tasks: {
            task1: { id: 'task1', status: 'pending', dependencies: [] },
          },
          agents: {},
        }),
        update: vi.fn(),
      } as any,
      trajectory: { log: vi.fn() } as any,
    });

    coordinator['workflow'] = {
      name: 'test',
      phases: [
        { name: 'implement', agent: 'dev', queue: 'tasks', parallel: 2 },
      ],
      orchestrator: 'orch',
      agents: { dev: { name: 'dev' } },
      gates: {},
      queues: { tasks: { name: 'tasks' } },
    } as any;

    coordinator['spawnTriggerManager'] = {
      checkTriggers: vi.fn().mockReturnValue([
        { agentType: 'dev', taskId: 'task1' },
      ]),
    } as any;

    const specs = await coordinator.checkSpawnTriggers();
    expect(specs).toHaveLength(1);
    expect(specs[0]).toEqual({ agentType: 'dev', taskId: 'task1' });
  });

  it('executes gate and returns result', async () => {
    const mockGateExecutor = {
      execute: vi.fn().mockResolvedValue({ passed: true }),
    };

    const coordinator = new WorkflowCoordinator({
      stateManager: { update: vi.fn() } as any,
      trajectory: { log: vi.fn() } as any,
    });

    coordinator['workflow'] = {
      name: 'test',
      phases: [],
      orchestrator: 'orch',
      agents: {},
      gates: {
        'gate-1': { name: 'gate-1', requires: ['pnpm test'] },
      },
      queues: {},
    } as any;
    coordinator['gateExecutor'] = mockGateExecutor as any;

    const result = await coordinator.executeGate('gate-1');
    expect(result).toEqual({ passed: true });
  });

  it('performs phase transition and logs event', async () => {
    const mockLog = vi.fn();
    const mockUpdate = vi.fn();

    const coordinator = new WorkflowCoordinator({
      stateManager: {
        load: vi.fn().mockResolvedValue({
          currentPhase: 'phase-1',
          phaseHistory: [],
        }),
        update: mockUpdate,
      } as any,
      trajectory: { log: mockLog } as any,
    });

    coordinator['workflow'] = {
      name: 'test',
      phases: [{ name: 'phase-1' }, { name: 'phase-2' }],
      orchestrator: 'orch',
      agents: {},
      gates: {},
      queues: {},
    } as any;

    await coordinator.transitionTo('phase-2');

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'phase_transition',
        from: 'phase-1',
        to: 'phase-2',
      })
    );
  });

  it('returns null when gate not found', async () => {
    const coordinator = new WorkflowCoordinator({
      stateManager: { update: vi.fn() } as any,
      trajectory: { log: vi.fn() } as any,
    });

    coordinator['workflow'] = {
      name: 'test',
      phases: [],
      orchestrator: 'orch',
      agents: {},
      gates: {},
      queues: {},
    } as any;

    const result = await coordinator.executeGate('nonexistent');
    expect(result).toBeNull();
  });

  it('initializes managers after loading workflow', async () => {
    const { readFile } = await import('node:fs/promises');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      name: 'test-workflow',
      phases: [
        { name: 'phase-1', requires: [], outputs: ['artifact-1'] },
        { name: 'phase-2', requires: ['artifact-1'] },
      ],
      orchestrator: 'orch',
      agents: { orch: { name: 'orch' } },
      gates: { 'gate-1': { name: 'gate-1', requires: ['test'] } },
      queues: { tasks: { name: 'tasks' } },
    }));

    const coordinator = new WorkflowCoordinator({
      stateManager: { update: vi.fn() } as any,
      trajectory: { log: vi.fn() } as any,
    });

    await coordinator.load('/tmp/workflow.json');

    // Verify managers are initialized
    expect(coordinator['phaseManager']).toBeDefined();
    expect(coordinator['spawnTriggerManager']).toBeDefined();
    expect(coordinator['gateExecutor']).toBeDefined();
  });

  it('returns current phase from state', async () => {
    const coordinator = new WorkflowCoordinator({
      stateManager: {
        load: vi.fn().mockResolvedValue({
          currentPhase: 'implement',
        }),
        update: vi.fn(),
      } as any,
      trajectory: { log: vi.fn() } as any,
    });

    const phase = await coordinator.getCurrentPhase();
    expect(phase).toBe('implement');
  });
});
