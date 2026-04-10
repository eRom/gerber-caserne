import { copyFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export async function restore(
  sourcePath: string,
  targetPath: string,
  lockDir?: string,
): Promise<void> {
  const dir = lockDir ?? resolve(homedir(), '.agent-brain');
  const lockPath = join(dir, 'restore.lock');

  if (existsSync(lockPath)) {
    throw new Error('Restore already in progress (lock file exists). Remove ' + lockPath + ' if stale.');
  }

  try {
    writeFileSync(lockPath, String(Date.now()));

    // Copy source over target
    copyFileSync(sourcePath, targetPath);

    // Clean up WAL/SHM files if they exist
    const walPath = targetPath + '-wal';
    const shmPath = targetPath + '-shm';
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  } finally {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '')) {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: pnpm mcp:restore <backup-path>');
    process.exit(1);
  }
  const target = resolve(homedir(), '.agent-brain', 'brain.db');
  restore(source, target).then(() => {
    console.log('Restore complete.');
  }).catch(err => {
    console.error('Restore failed:', err.message);
    process.exit(1);
  });
}
