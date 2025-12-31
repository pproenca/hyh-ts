import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface Artifact {
  taskId: string;
  status: string;
  summary: string;
  files: {
    created: string[];
    modified: string[];
  };
  exports: string[];
  tests: {
    passed: number;
    failed: number;
    command: string;
  };
  notes: string;
}

export class ArtifactManager {
  private readonly artifactDir: string;

  constructor(artifactDir: string) {
    this.artifactDir = artifactDir;
  }

  async save(artifact: Artifact): Promise<void> {
    await fs.mkdir(this.artifactDir, { recursive: true });

    const markdown = this.formatAsMarkdown(artifact);
    const filePath = path.join(this.artifactDir, `${artifact.taskId}.md`);
    await fs.writeFile(filePath, markdown);
  }

  async load(taskId: string): Promise<Artifact | null> {
    const filePath = path.join(this.artifactDir, `${taskId}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarkdown(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async loadForDependencies(taskIds: string[]): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    for (const taskId of taskIds) {
      const artifact = await this.load(taskId);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  private formatAsMarkdown(artifact: Artifact): string {
    const lines: string[] = [
      `# Task: ${artifact.taskId}`,
      '',
      `**Status:** ${artifact.status}`,
      '',
      '## Summary',
      '',
      artifact.summary,
      '',
      '## Files',
      '',
      '### Created',
      '',
    ];

    if (artifact.files.created.length > 0) {
      artifact.files.created.forEach((file) => lines.push(`- ${file}`));
    } else {
      lines.push('(none)');
    }

    lines.push('', '### Modified', '');

    if (artifact.files.modified.length > 0) {
      artifact.files.modified.forEach((file) => lines.push(`- ${file}`));
    } else {
      lines.push('(none)');
    }

    lines.push('', '## Exports', '');

    if (artifact.exports.length > 0) {
      artifact.exports.forEach((exp) => lines.push(`- ${exp}`));
    } else {
      lines.push('(none)');
    }

    lines.push(
      '',
      '## Tests',
      '',
      `- Passed: ${artifact.tests.passed}`,
      `- Failed: ${artifact.tests.failed}`,
      `- Command: \`${artifact.tests.command}\``,
      '',
      '## Notes',
      '',
      artifact.notes || '(none)',
      '',
    );

    return lines.join('\n');
  }

  private parseMarkdown(content: string): Artifact {
    const taskIdMatch = content.match(/^# Task: (.+)$/m);
    const statusMatch = content.match(/^\*\*Status:\*\* (.+)$/m);
    const summaryMatch = content.match(/## Summary\n\n([^\n#]+)/);
    const notesMatch = content.match(/## Notes\n\n(.+)$/s);

    const createdMatch = content.match(/### Created\n\n([\s\S]*?)(?=\n### Modified)/);
    const modifiedMatch = content.match(/### Modified\n\n([\s\S]*?)(?=\n## Exports)/);
    const exportsMatch = content.match(/## Exports\n\n([\s\S]*?)(?=\n## Tests)/);

    const passedMatch = content.match(/- Passed: (\d+)/);
    const failedMatch = content.match(/- Failed: (\d+)/);
    const commandMatch = content.match(/- Command: `(.+)`/);

    const parseList = (section: string | undefined): string[] => {
      if (!section || section.includes('(none)')) return [];
      return section
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2).trim());
    };

    return {
      taskId: taskIdMatch?.[1] ?? '',
      status: statusMatch?.[1] ?? '',
      summary: summaryMatch?.[1]?.trim() ?? '',
      files: {
        created: parseList(createdMatch?.[1]),
        modified: parseList(modifiedMatch?.[1]),
      },
      exports: parseList(exportsMatch?.[1]),
      tests: {
        passed: parseInt(passedMatch?.[1] ?? '0', 10),
        failed: parseInt(failedMatch?.[1] ?? '0', 10),
        command: commandMatch?.[1] ?? '',
      },
      notes: notesMatch?.[1]?.trim() === '(none)' ? '' : (notesMatch?.[1]?.trim() ?? ''),
    };
  }
}
