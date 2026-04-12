export const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000' as const;

export const LIMITS = {
  MAX_TITLE: 200,
  MAX_TAG: 40,
  MAX_TAGS_PER_NOTE: 20,
  MAX_QUERY: 500,
  MAX_PROJECT_SLUG: 64,
  MAX_PROJECT_NAME: 120,
  MAX_PROJECT_DESCRIPTION: 500,
  MAX_BACKUP_LABEL: 64,
  MAX_LIST_LIMIT: 200,
  MAX_SEARCH_LIMIT: 50,
  MAX_NEIGHBORS: 3,
  MAX_CONTENT: 1_000_000,        // 1 MB markdown guard
} as const;

export const KINDS = ['atom', 'document'] as const;
export const STATUSES = ['draft', 'active', 'archived', 'deprecated'] as const;
export const SOURCES = ['ai', 'human', 'import'] as const;
export const SEARCH_MODES = ['fulltext', 'semantic', 'hybrid'] as const;

export const MESSAGE_TYPES = ['context', 'reminder'] as const;
export const MESSAGE_STATUSES = ['pending', 'done'] as const;

export const TASK_STATUSES = ['inbox', 'brainstorming', 'specification', 'plan', 'implementation', 'test', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;

export const ISSUE_STATUSES = ['inbox', 'in_progress', 'in_review', 'closed'] as const;
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const ISSUE_SEVERITIES = ['bug', 'regression', 'warning', 'enhancement'] as const;
