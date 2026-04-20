import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface GerberConfig {
  streamable_token?: string;
  editor_cmd?: string;
}

const DEFAULT_EDITOR = 'zed .';

let cached: GerberConfig | null = null;

function load(): GerberConfig {
  if (cached) return cached;
  const path = join(homedir(), '.config', 'gerber', 'config.json');
  if (!existsSync(path)) {
    cached = {};
    return cached;
  }
  try {
    cached = JSON.parse(readFileSync(path, 'utf-8')) as GerberConfig;
  } catch {
    cached = {};
  }
  return cached;
}

export function getEditorCmd(): string {
  return load().editor_cmd ?? DEFAULT_EDITOR;
}
