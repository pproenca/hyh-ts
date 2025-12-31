// packages/tui/src/tabs/Agents.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface ContextUsage {
  current: number;
  max: number;
}

interface AgentWithContext {
  id: string;
  type: string;
  status: 'idle' | 'active' | 'stopped';
  currentTask: string | null;
  lastHeartbeat: number | null;
  contextUsage?: ContextUsage;
}

interface AgentsProps {
  state: WorkflowState | null;
  onAttach?: (agentId: string) => void;
}

function formatHeartbeat(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const now = Date.now();
  const diffSeconds = Math.floor((now - timestamp) / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'active': return '●';
    case 'idle': return '○';
    case 'stopped': return '■';
    default: return '?';
  }
}

function getStatusColor(status: string): string | undefined {
  switch (status) {
    case 'active': return 'green';
    case 'idle': return undefined;
    case 'stopped': return 'red';
    default: return undefined;
  }
}

function AgentContextUsage({ usage }: { usage?: ContextUsage }) {
  if (!usage) return null;

  const pct = Math.round((usage.current / usage.max) * 100);
  const color = pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green';

  return (
    <Text color={color}>Context: {pct}%</Text>
  );
}

export function Agents({ state, onAttach }: AgentsProps) {
  if (!state) {
    return <Text dimColor>No agents</Text>;
  }

  const agents = Object.values(state.agents ?? {});

  if (agents.length === 0) {
    return <Text dimColor>No agents</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold>AGENTS ({agents.length})</Text>
        {onAttach && <Text dimColor> [a] attach</Text>}
      </Box>
      {agents.map(agent => {
        const heartbeat = formatHeartbeat(agent.lastHeartbeat ?? null);
        const agentWithContext = agent as AgentWithContext;
        const agentId = agent.id ?? 'unknown';
        const agentStatus = agent.status ?? 'idle';
        return (
          <Box key={agentId} marginTop={1} flexDirection="column">
            <Text>
              {(() => {
                const statusColor = getStatusColor(agentStatus);
                const icon = getStatusIcon(agentStatus);
                return statusColor ? <Text color={statusColor}>{icon}</Text> : <Text>{icon}</Text>;
              })()} {agent.id}
              <Text dimColor> ({agent.type})</Text>
              {agent.currentTask && <Text color="yellow"> → {agent.currentTask}</Text>}
            </Text>
            {heartbeat && (
              <Text dimColor>  Last heartbeat: {heartbeat}</Text>
            )}
            {agentWithContext.contextUsage && (
              <Box marginLeft={2}>
                <AgentContextUsage usage={agentWithContext.contextUsage} />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
