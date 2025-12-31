// packages/tui/src/hooks/useDaemon.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Create mock client factory
const createMockClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  request: vi.fn(),
  onEvent: vi.fn(),
  offEvent: vi.fn(),
});

let mockClient = createMockClient();

// Mock the IPCClient constructor before any imports
vi.mock('@hyh/daemon', () => ({
  IPCClient: vi.fn().mockImplementation(() => mockClient),
}));

// Import the mocked module to get access to the mock
import { IPCClient } from '@hyh/daemon';

// Define response types inline
interface OkResponse {
  status: 'ok';
  data: unknown;
}

interface ErrorResponse {
  status: 'error';
  message: string;
}

type MockResponse = OkResponse | ErrorResponse;

// Define WorkflowState inline
interface WorkflowState {
  workflowId: string;
  workflowName: string;
  startedAt: number;
  currentPhase: string;
  phaseHistory: Array<{ from: string; to: string; timestamp: number }>;
  tasks: Record<string, TaskState>;
  agents: Record<string, unknown>;
  checkpoints: Record<string, unknown>;
  pendingHumanActions: unknown[];
}

interface TaskState {
  id: string;
  description: string;
  status: string;
  claimedBy: string | null;
  claimedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  attempts: number;
  lastError: string | null;
  dependencies: string[];
  files: string[];
  timeoutSeconds: number;
}

// Import the hook to test (this should work since IPCClient is already mocked)
import { useDaemon } from './useDaemon.js';

describe('useDaemon hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock client for each test
    mockClient = createMockClient();
    // Reset the mock implementation
    vi.mocked(IPCClient).mockImplementation(() => mockClient);
  });

  it('should start disconnected with null state', () => {
    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    // Initially should be disconnected
    expect(result.current.connected).toBe(false);
    expect(result.current.state).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.events).toEqual([]);
  });

  it('should connect to daemon on mount', async () => {
    const mockState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'planning',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: mockState },
    } as MockResponse);

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    expect(mockClient.connect).toHaveBeenCalled();
  });

  it('should fetch state after connecting', async () => {
    const mockState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test Workflow',
      startedAt: Date.now(),
      currentPhase: 'implementation',
      phaseHistory: [],
      tasks: {
        task1: {
          id: 'task1',
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
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: mockState },
    } as MockResponse);

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    expect(result.current.state?.workflowId).toBe('test-workflow');
    expect(result.current.state?.currentPhase).toBe('implementation');
    expect(result.current.state?.tasks.task1).toBeDefined();
  });

  it('should handle connection errors', async () => {
    const connectionError = new Error('Connection refused');
    mockClient.connect.mockRejectedValue(connectionError);

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error?.message).toBe('Connection refused');
  });

  it('should handle request errors during state fetch', async () => {
    mockClient.request.mockRejectedValue(new Error('Request failed'));

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('Request failed');
  });

  it('should provide refresh function to fetch latest state', async () => {
    const initialState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'planning',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    const updatedState: WorkflowState = {
      ...initialState,
      currentPhase: 'implementation',
    };

    mockClient.request
      .mockResolvedValueOnce({ status: 'ok', data: { state: initialState } })
      .mockResolvedValueOnce({ status: 'ok', data: { state: updatedState } });

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.state?.currentPhase).toBe('planning');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state?.currentPhase).toBe('implementation');
  });

  it('should disconnect on unmount', async () => {
    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: null },
    });

    const { result, unmount } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    unmount();

    expect(mockClient.disconnect).toHaveBeenCalled();
  });

  it('should register event listener for real-time updates', async () => {
    const mockState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'planning',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: mockState },
    });

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Should register event listener for state updates
    expect(mockClient.onEvent).toHaveBeenCalledWith('state_update', expect.any(Function));
  });

  it('should update state when receiving state_update events', async () => {
    const initialState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'planning',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: initialState },
    });

    let stateUpdateCallback: ((event: unknown) => void) | null = null;
    mockClient.onEvent.mockImplementation((event: string, callback: (event: unknown) => void) => {
      if (event === 'state_update') {
        stateUpdateCallback = callback;
      }
    });

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.state?.currentPhase).toBe('planning');
    });

    // Simulate a state update event
    const updatedState: WorkflowState = {
      ...initialState,
      currentPhase: 'implementation',
    };

    await act(async () => {
      stateUpdateCallback?.({ state: updatedState });
    });

    expect(result.current.state?.currentPhase).toBe('implementation');
  });

  it('should track events array', async () => {
    const mockState: WorkflowState = {
      workflowId: 'test-workflow',
      workflowName: 'Test',
      startedAt: Date.now(),
      currentPhase: 'planning',
      phaseHistory: [],
      tasks: {},
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: mockState },
    });

    let eventCallback: ((event: unknown) => void) | null = null;
    mockClient.onEvent.mockImplementation((eventType: string, callback: (event: unknown) => void) => {
      if (eventType === 'event') {
        eventCallback = callback;
      }
    });

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    expect(result.current.events).toEqual([]);

    // Simulate receiving events
    const testEvent = { type: 'task_started', taskId: 'task1' };
    await act(async () => {
      eventCallback?.(testEvent);
    });

    expect(result.current.events).toContainEqual(testEvent);
  });

  it('should unregister event listeners on unmount', async () => {
    mockClient.request.mockResolvedValue({
      status: 'ok',
      data: { state: null },
    });

    const { result, unmount } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    unmount();

    expect(mockClient.offEvent).toHaveBeenCalled();
  });

  it('should handle error status in response', async () => {
    mockClient.request.mockResolvedValue({
      status: 'error',
      message: 'Workflow not found',
    } as MockResponse);

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toContain('Workflow not found');
  });
});
