import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput, Select, ConfirmInput } from '@inkjs/ui';

interface WorkflowConfig {
  name: string;
  model: 'opus' | 'sonnet';
  parallel: number;
}

interface BuilderProps {
  onComplete: (config: WorkflowConfig) => void;
}

type BuilderStep = 'name' | 'model' | 'parallel' | 'confirm';

export function Builder({ onComplete }: BuilderProps) {
  const [step, setStep] = useState<BuilderStep>('name');
  const [config, setConfig] = useState<Partial<WorkflowConfig>>({});

  const handleNameSubmit = (value: string) => {
    setConfig((c) => ({ ...c, name: value }));
    setStep('model');
  };

  const handleModelSelect = (value: string) => {
    setConfig((c) => ({ ...c, model: value as 'opus' | 'sonnet' }));
    setStep('parallel');
  };

  const handleParallelSelect = (value: string) => {
    setConfig((c) => ({ ...c, parallel: parseInt(value, 10) }));
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (config.name && config.model && config.parallel) {
      onComplete(config as WorkflowConfig);
    }
  };

  const handleCancel = () => {
    setStep('name');
    setConfig({});
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Create Your Workflow
        </Text>
      </Box>

      {step === 'name' && (
        <Box>
          <Text>Workflow name: </Text>
          <TextInput
            placeholder="my-feature"
            onSubmit={handleNameSubmit}
          />
        </Box>
      )}

      {step === 'model' && (
        <Box flexDirection="column">
          <Text>Select orchestrator model:</Text>
          <Select
            options={[
              { label: 'Opus (most capable)', value: 'opus' },
              { label: 'Sonnet (faster)', value: 'sonnet' },
            ]}
            onChange={handleModelSelect}
          />
        </Box>
      )}

      {step === 'parallel' && (
        <Box flexDirection="column">
          <Text>Max parallel agents:</Text>
          <Select
            options={[
              { label: '1 (sequential)', value: '1' },
              { label: '2', value: '2' },
              { label: '3 (recommended)', value: '3' },
              { label: '5', value: '5' },
            ]}
            onChange={handleParallelSelect}
          />
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text>Create workflow "{config.name}" with {config.model} and {config.parallel} parallel agents?</Text>
          <ConfirmInput onConfirm={handleConfirm} onCancel={handleCancel} />
        </Box>
      )}
    </Box>
  );
}
