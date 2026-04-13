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

// ---- Spinner frames ----
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
