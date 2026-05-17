export const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000' as const;

export const LIMITS = {
  MAX_TITLE: 200,
  MAX_TAG: 40,
  MAX_TAGS_PER_ENTITY: 20,
  MAX_PROJECT_SLUG: 64,
  MAX_PROJECT_NAME: 120,
  MAX_PROJECT_DESCRIPTION: 500,
  MAX_BACKUP_LABEL: 64,
  MAX_LIST_LIMIT: 200,
} as const;

export const MESSAGE_TYPES = ['context', 'reminder'] as const;
export const MESSAGE_STATUSES = ['pending', 'done'] as const;

export const HANDOFF_STATUSES = ['inbox', 'done'] as const;
