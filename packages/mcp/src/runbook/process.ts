import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

export interface SpawnOptions {
  cmd: string;
  cwd: string;
  env: Record<string, string>;
  logPath: string;
}

export function spawnDetached(opts: SpawnOptions): number {
  const fd = openSync(opts.logPath, 'w');
  try {
    const child = spawn('sh', ['-c', opts.cmd], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      detached: true,
      stdio: ['ignore', fd, fd],
    });
    child.unref();
    if (child.pid === undefined) {
      throw new Error('spawn failed: no PID returned');
    }
    return child.pid;
  } finally {
    closeSync(fd);
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid: number, force = false): void {
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // Already dead
  }
}
