// packages/cli/src/utils/worker-id.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const WORKER_ID_FILE = path.join(os.homedir(), '.hyh', 'worker-id');

export async function getWorkerId(): Promise<string> {
  // Check environment override
  if (process.env.HYH_WORKER_ID) {
    return process.env.HYH_WORKER_ID;
  }

  // Try to read existing ID
  try {
    const id = await fs.readFile(WORKER_ID_FILE, 'utf-8');
    return id.trim();
  } catch {
    // Generate new ID
    const id = `worker-${crypto.randomBytes(6).toString('hex')}`;

    // Persist atomically
    await fs.mkdir(path.dirname(WORKER_ID_FILE), { recursive: true });
    const tmpFile = `${WORKER_ID_FILE}.tmp`;
    await fs.writeFile(tmpFile, id);
    await fs.rename(tmpFile, WORKER_ID_FILE);

    return id;
  }
}
