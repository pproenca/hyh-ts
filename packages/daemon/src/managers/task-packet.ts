export interface TaskPacketInput {
  taskId: string;
  description: string;
  files: string[];
  dependencies?: string[];
  interfaces?: string[];
  exclude?: string[];
}

export interface TaskPacket {
  objective: string;
  constraints: {
    fileScope: string[];
    tdd: boolean;
  };
  context: {
    interfaces: string[];
    dependencyArtifacts: Record<string, { summary: string; exports: string[] }>;
  };
  doNot: string[];
}

export interface ArtifactManagerLike {
  loadForDependencies(
    taskIds: string[]
  ): Promise<Record<string, { summary: string; exports: string[] }>>;
}

interface TaskPacketFactoryOptions {
  artifactManager?: ArtifactManagerLike;
}

export class TaskPacketFactory {
  private readonly artifactManager: ArtifactManagerLike | undefined;

  constructor(options?: TaskPacketFactoryOptions) {
    this.artifactManager = options?.artifactManager;
  }

  create(input: TaskPacketInput): TaskPacket {
    const doNot = ['modify files outside scope'];
    if (input.exclude?.includes('exploration')) {
      doNot.push('include exploration context');
    }
    if (input.exclude?.includes('history')) {
      doNot.push('include history context');
    }

    return {
      objective: input.description,
      constraints: {
        fileScope: input.files,
        tdd: true,
      },
      context: {
        interfaces: input.interfaces ?? [],
        dependencyArtifacts: {},
      },
      doNot,
    };
  }

  async createAsync(input: TaskPacketInput): Promise<TaskPacket> {
    const packet = this.create(input);

    if (this.artifactManager && input.dependencies?.length) {
      const artifacts = await this.artifactManager.loadForDependencies(
        input.dependencies
      );
      packet.context.dependencyArtifacts = artifacts;
    }

    return packet;
  }
}
