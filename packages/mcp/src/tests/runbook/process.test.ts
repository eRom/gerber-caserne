import { describe, it, expect } from 'vitest';
import { spawnDetached, isAlive } from '../../runbook/process.js';
import { logPathForSlug } from '../../runbook/logs.js';

describe('process helpers', () => {
  it('isAlive returns false for PID 2^31-1', () => {
    expect(isAlive(2147483646)).toBe(false);
  });

  it('isAlive returns true for current process', () => {
    expect(isAlive(process.pid)).toBe(true);
  });

  it('spawnDetached starts a process and returns pid', () => {
    const logPath = logPathForSlug('test-spawn');
    const pid = spawnDetached({
      cmd: 'sleep 2',
      cwd: '/tmp',
      env: {},
      logPath,
    });
    expect(typeof pid).toBe('number');
    expect(isAlive(pid)).toBe(true);
    try { process.kill(pid, 'SIGTERM'); } catch {}
  });
});
