// packages/tui/src/hooks/useDaemon.ts
import { useState, useEffect, useCallback } from 'react';
import { IPCClient } from '@hyh/daemon';
import type { WorkflowState } from '@hyh/daemon';

interface DaemonConnection {
  connected: boolean;
  state: WorkflowState | null;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useDaemon(socketPath: string): DaemonConnection {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [client] = useState(() => new IPCClient(socketPath));

  const refresh = useCallback(async () => {
    try {
      const response = await client.request({ command: 'get_state' });
      if (response.status === 'ok' && response.data) {
        setState((response.data as { state: WorkflowState }).state);
      }
    } catch (err) {
      setError(err as Error);
    }
  }, [client]);

  useEffect(() => {
    async function connect() {
      try {
        await client.connect();
        setConnected(true);
        await refresh();
      } catch (err) {
        setError(err as Error);
      }
    }

    connect();

    return () => {
      client.disconnect();
    };
  }, [client, refresh]);

  return { connected, state, error, refresh };
}
