// packages/cli/src/utils/socket.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export async function findSocketPath(): Promise<string | null> {
  const socketsDir = path.join(os.homedir(), '.hyh', 'sockets');

  // First, try the current working directory
  const cwd = process.cwd();
  const cwdSocketPath = getSocketPathForWorktree(cwd);

  try {
    await fs.access(cwdSocketPath);
    return cwdSocketPath;
  } catch {
    // Socket for cwd doesn't exist, continue searching
  }

  // Fall back to first available socket
  try {
    const files = await fs.readdir(socketsDir);
    const sockets = files.filter((f) => f.endsWith('.sock'));

    const firstSocket = sockets[0];
    if (!firstSocket) {
      return null;
    }

    // Return first socket
    return path.join(socketsDir, firstSocket);
  } catch {
    return null;
  }
}

export function getSocketPathForWorktree(worktreeRoot: string): string {
  const hash = crypto.createHash('sha256').update(worktreeRoot).digest('hex').slice(0, 16);
  return path.join(os.homedir(), '.hyh', 'sockets', `${hash}.sock`);
}
