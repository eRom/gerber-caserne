import { z } from 'zod';
import {
  ProjectSchema, StatsSchema,
} from './schemas.js';

export type Project = z.infer<typeof ProjectSchema>;
export type Stats = z.infer<typeof StatsSchema>;
