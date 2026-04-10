export const CHUNK_CONFIG = {
  strategy: 'ast-header-split' as const,
  maxTokens: 450,
  maxDepth: 3,          // split on H1, H2, H3 only
  version: 1,
} as const;
