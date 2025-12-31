// packages/tui/src/hooks/useDaemon.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { IPCClient } from '@hyh/daemon';
import type { WorkflowState } from '@hyh/daemon';

interface DaemonConnection {
  connected: boolean;
  state: WorkflowState | null;
  events: unknown[];
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useDaemon(socketPath: string): DaemonConnection {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<IPCClient | null>(null);

  const refresh = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      const response = await client.request({ command: 'get_state' });
      if (response.status === 'ok' && response.data) {
        setState((response.data as { state: WorkflowState }).state);
      } else if (response.status === 'error') {
        setError(new Error(response.message || 'Unknown error'));
      }
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  useEffect(() => {
    const client = new IPCClient(socketPath);
    clientRef.current = client;

    const handleStateUpdate = (eventData: unknown) => {
      const data = eventData as { state: WorkflowState };
      if (data.state) {
        setState(data.state);
      }
    };

    const handleEvent = (eventData: unknown) => {
      setEvents((prev) => [...prev, eventData]);
    };

    async function connect() {
      try {
        await client.connect();
        setConnected(true);

        // Register event listeners
        client.onEvent('state_update', handleStateUpdate);
        client.onEvent('event', handleEvent);

        // Fetch initial state
        await refresh();
      } catch (err) {
        setError(err as Error);
        setConnected(false);
      }
    }

    connect();

    return () => {
      client.offEvent('state_update', handleStateUpdate);
      client.offEvent('event', handleEvent);
      client.disconnect();
      clientRef.current = null;
    };
  }, [socketPath, refresh]);

  return { connected, state, events, error, refresh };
}
