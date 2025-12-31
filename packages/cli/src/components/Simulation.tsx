import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { Spinner, ProgressBar } from '@inkjs/ui';
import { useSimulation } from '../hooks/useSimulation.js';
import type { SimulationStep, SimulationAgent, SimulationTask } from '../hooks/useSimulation.js';

interface SimulationProps {
  steps: SimulationStep[];
  intervalMs?: number;
  onComplete?: () => void;
}

function AgentCard({ agent }: { agent: SimulationAgent }) {
  const statusColor = agent.status === 'working' ? 'yellow' : agent.status === 'done' ? 'green' : 'gray';
  return (
    <Box marginRight={2}>
      <Text color={statusColor}>
        {agent.status === 'working' ? '● ' : agent.status === 'done' ? '✓ ' : '○ '}
      </Text>
      <Text bold>{agent.name}</Text>
      <Text dimColor> ({agent.model})</Text>
      {agent.status === 'working' && <Spinner label="" />}
    </Box>
  );
}

function TaskItem({ task }: { task: SimulationTask }) {
  const icon = task.status === 'completed' ? '✓' : task.status === 'running' ? '→' : '○';
  const color = task.status === 'completed' ? 'green' : task.status === 'running' ? 'yellow' : 'gray';
  return (
    <Box>
      <Text color={color}>{icon} </Text>
      <Text>{task.name}</Text>
      {task.agent && <Text dimColor> [{task.agent}]</Text>}
    </Box>
  );
}

export function Simulation({ steps, intervalMs = 800, onComplete }: SimulationProps) {
  const { current, isComplete, progress } = useSimulation(steps, intervalMs);
  const completeCalled = useRef(false);

  useEffect(() => {
    if (isComplete && onComplete && !completeCalled.current) {
      completeCalled.current = true;
      onComplete();
    }
  }, [isComplete, onComplete]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Phase: </Text>
        <Text>{current.phase}</Text>
      </Box>

      {current.agents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Agents:</Text>
          <Box>
            {current.agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </Box>
        </Box>
      )}

      {current.tasks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Tasks:</Text>
          {current.tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </Box>
      )}

      {current.events.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>Events:</Text>
          {current.events.slice(-3).map((event, i) => (
            <Text key={i} dimColor>  {event}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <ProgressBar value={Math.round(progress)} />
        <Text> {Math.round(progress)}%</Text>
      </Box>
    </Box>
  );
}
