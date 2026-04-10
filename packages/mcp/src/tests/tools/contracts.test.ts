import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate, projectList, projectUpdate, projectDelete } from '../../tools/projects.js';
import { RESPONSE_SHAPES } from '../../tools/contracts.js';

describe('contract validation', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('project_create matches MutationResponseSchema(Project)', () => {
    const result = projectCreate(db, { slug: 'contract-test', name: 'CT' });
    expect(() => RESPONSE_SHAPES.project_create.parse(result)).not.toThrow();
  });

  it('project_list matches ListResponseSchema(Project)', () => {
    const result = projectList(db, {});
    expect(() => RESPONSE_SHAPES.project_list.parse(result)).not.toThrow();
  });

  it('project_update matches MutationResponseSchema(Project)', () => {
    const { id } = projectCreate(db, { slug: 'upd-ct', name: 'Before' });
    const result = projectUpdate(db, { id, name: 'After' });
    expect(() => RESPONSE_SHAPES.project_update.parse(result)).not.toThrow();
  });

  it('project_delete matches MutationResponseSchema', () => {
    const { id } = projectCreate(db, { slug: 'del-ct', name: 'Del' });
    const result = projectDelete(db, { id });
    expect(() => RESPONSE_SHAPES.project_delete.parse(result)).not.toThrow();
  });
});
