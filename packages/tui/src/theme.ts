// ---- Task statuses ----
export const TASK_STATUS_COLORS: Record<string, string> = {
  inbox:          'gray',
  brainstorming:  'magenta',
  specification:  'cyan',
  plan:           'blue',
  implementation: 'yellow',
  test:           'yellowBright',
  done:           'green',
};

// ---- Issue statuses ----
export const ISSUE_STATUS_COLORS: Record<string, string> = {
  inbox:       'gray',
  in_progress: 'yellow',
  in_review:   'cyan',
  closed:      'green',
};

// ---- Priorities ----
export const PRIORITY_COLORS: Record<string, string> = {
  low:      'gray',
  normal:   'white',
  high:     'red',
  critical: 'redBright',
};

// ---- Severities ----
export const SEVERITY_COLORS: Record<string, string> = {
  enhancement: 'cyan',
  warning:     'yellow',
  bug:         'red',
  regression:  'redBright',
};

// ---- Note statuses ----
export const NOTE_STATUS_COLORS: Record<string, string> = {
  draft:      'gray',
  active:     'green',
  archived:   'yellow',
  deprecated: 'red',
};

// ---- Note kinds ----
export const KIND_COLORS: Record<string, string> = {
  atom:     'cyan',
  document: 'blue',
};

// ---- Message statuses ----
export const MESSAGE_STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  done:    'green',
};

// ---- Short display labels ----
export const TASK_STATUS_LABELS: Record<string, string> = {
  inbox:          'inbox',
  brainstorming:  'brains',
  specification:  'specs',
  plan:           'plan',
  implementation: 'dev',
  test:           'test',
  done:           'done',
};

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  inbox:       'inbox',
  in_progress: 'in_progress',
  in_review:   'in_review',
  closed:      'closed',
};

export function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

// ---- Spinner frames ----
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
