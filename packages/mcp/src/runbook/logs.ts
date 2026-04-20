import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function runsDir(): string {
  const xdgState = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  const dir = join(xdgState, 'gerber', 'runs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logPathForSlug(slug: string): string {
  return join(runsDir(), `${slug}.log`);
}
