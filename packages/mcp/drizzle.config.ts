import type { Config } from 'drizzle-kit';
export default {
  schema: '../shared/src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
} satisfies Config;
