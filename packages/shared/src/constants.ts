// Most LIMITS keys were tied to the projects/messages/tasks/issues tables that
// have all been dropped. What remains is a small list of generic caps still
// useful to skills / future tools.
export const LIMITS = {
  MAX_TITLE: 200,
  MAX_LIST_LIMIT: 200,
} as const;
