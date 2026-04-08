# agent-brain — MVP Design Spec

> Date : 2026-04-08
> Statut : draft, pending review
> Brainstorm source : session `superpowers:brainstorming` du 2026-04-08 (Trinity + Romain)
> Contexte d'entrée : `ADN-Barda.md` (analyse du repo de référence), `project_agent_brain_vision.md` (vision long-terme)

## 0 — Résumé

agent-brain est un **serveur MCP monorepo (stdio + HTTP) + UI web locale** qui stocke, indexe et expose une mémoire IA cross-projets. Pattern inspiré de Barda Bible : un seul process Node, deux interfaces (stdio pour les agents IA, Express+React pour l'humain), une seule base SQLite avec FTS5 + embeddings E5-base locaux.

Cibles :

- **80 % des écritures viennent de l'IA** (auto-archive fin de session via un futur skill Claude Code), 20 % humaines (quick-capture depuis Apple Notes).
- **Consultation principale via ⌘K** dans l'UI web locale, pas de déploiement distant, pas d'auth, pas de cloud.
- **Multi-projet dès le MVP** : 1 table `projects`, 1 row `global` seeded pour les notes cross-projets.
- **Deux types de notes uniquement** : `atom` (dense, 1 idée = 1 note) et `document` (multi-section, chunké à l'ingestion). Les "gotcha / spec / plan / journal" sont des **tags**, pas des types.
- **Stack 100 % local** : SQLite + better-sqlite3 + Drizzle + FTS5 + @huggingface/transformers + Xenova/multilingual-e5-base.

---

## 1 — Architecture globale

```
agent-brain/                                   (pnpm monorepo)
├── packages/
│   ├── mcp/                                   @agent-brain/mcp
│   │   ├── src/
│   │   │   ├── index.ts                       CLI entry : stdio | --ui
│   │   │   ├── db/                            drizzle schema, migrations, fts triggers, views
│   │   │   ├── embeddings/                    E5-base wrapper, chunking (C light), content_hash
│   │   │   ├── tools/                         MCP tools (zod schemas + handlers)
│   │   │   ├── search/                        fulltext / semantic / hybrid (RRF)
│   │   │   └── http/                          Express 5 + JSON-RPC maison (~70 lignes)
│   │   └── public/                            UI build copié ici par vite
│   ├── ui/                                    @agent-brain/ui
│   │   ├── src/
│   │   │   ├── api/mcp-client.ts              fetch POST /mcp
│   │   │   ├── hooks/                         useProjects / useNotes / useSearch / useStats
│   │   │   ├── pages/                         Dashboard, Project, Note, Search, Import, Settings
│   │   │   ├── components/                    NoteList, NoteEditor, TagChip, Sidebar, ...
│   │   │   └── design-system/                 oklch vars hérités erom-design (dark-first)
│   │   └── vite.config.ts
│   └── shared/                                @agent-brain/shared
│       └── src/index.ts                       types Drizzle inférés, limites, constantes
├── pnpm-workspace.yaml
├── package.json                               name: agent-brain-workspace (évite collision scope)
└── docs/superpowers/specs/                    ce spec + futurs
```

### 1.1 — Deux modes d'exécution

```
                    ┌──────────────────────────────┐
                    │   packages/mcp/src/index.ts  │
                    │   parse --ui / --db-path     │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┴────────────────┐
        (--ui absent)                    (--ui présent)
              │                                 │
              ▼                                 ▼
      McpServer stdio                  Express 127.0.0.1:<port>
      (pour agents IA :                POST /mcp → tools (JSON-RPC)
       Claude Code, Desktop,           GET  /*   → UI statique
       Cursor)                         auto-open browser
```

- En mode `--ui`, Express **ne réutilise pas** le transport SDK MCP. Il lit les tools enregistrés depuis `mcpServer._registeredTools` et route le JSON-RPC directement vers les handlers. ~70 lignes de code. Zéro duplication entre stdio et HTTP.
- Dev : `pnpm dev` via `concurrently` lance 2 process : (a) `tsx watch packages/mcp/src/index.ts --ui --port 4000` et (b) `vite packages/ui` (port 5173, proxy `/mcp → http://127.0.0.1:4000`). HMR complet côté UI.
- Prod/usage réel : `pnpm build` → UI dans `packages/mcp/public/` → `node packages/mcp/dist/index.js --ui` sert tout depuis Express 4000.

### 1.2 — DB et stockage

- Unique fichier SQLite : `~/.agent-brain/brain.db` (path configurable via `--db-path`).
- Backups : `~/.agent-brain/backups/<timestamp>-<label>.db`.
- WAL mode systématique. Pragmas au boot (**ordre important**) :
  ```
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;         -- 5s retry pour SQLITE_BUSY multi-process
  PRAGMA foreign_keys = ON;
  PRAGMA recursive_triggers = ON;     -- requis pour cascade → trigger embeddings orphelins
  ```
- Helper centralisé `openDatabase(path)` dans `db/index.ts`. Aucun `new Database()` ailleurs dans le code.

### 1.3 — Choix actés explicitement

- **DB = source of truth unique.** Pas de fichiers `.md` sur disque, pas de vault, pas de watcher, pas d'intégration Obsidian au MVP. Si un export devient nécessaire, ce sera un tool MCP `export_markdown` à ajouter, pas une refonte architecturale.
- **Local-only.** Bind `127.0.0.1` uniquement. Pas d'auth, pas d'HTTPS, pas de déploiement distant. Capture mobile via Apple Notes → paste dans l'UI au retour.
- **Multi-projet dès le MVP**, avec un row `global` seeded pour les notes cross-projets.

---

## 2 — Schéma DB

5 tables + 1 vue + 1 virtuelle FTS5.

### 2.1 — Tables

```ts
projects {
  id           TEXT PK                  -- uuid v4, sauf '00000000-0000-0000-0000-000000000000' pour 'global'
  slug         TEXT UNIQUE NOT NULL     -- "cruchot", "global", "agent-brain"
  name         TEXT NOT NULL
  description  TEXT
  repo_path    TEXT                     -- "/Users/recarnot/dev/cruchot" (optionnel)
  color        TEXT                     -- "#8b5cf6" pour badge UI
  created_at   INTEGER NOT NULL         -- Date.now() ms
  updated_at   INTEGER NOT NULL
}

notes {
  id            TEXT PK                 -- uuid v4
  project_id    TEXT NOT NULL FK projects.id
                DEFAULT '00000000-0000-0000-0000-000000000000'
  kind          TEXT NOT NULL           -- 'atom' | 'document'   CHECK constraint
  title         TEXT NOT NULL
  content       TEXT NOT NULL           -- full markdown brut
  tags          TEXT NOT NULL DEFAULT '[]'   -- JSON array string
  status        TEXT NOT NULL DEFAULT 'active'   -- 'draft' | 'active' | 'archived' | 'deprecated'
  source        TEXT NOT NULL           -- 'ai' | 'human' | 'import'
  content_hash  TEXT NOT NULL           -- sha256(content) → skip reindex si inchangé
  created_at    INTEGER NOT NULL
  updated_at    INTEGER NOT NULL
}
INDEX notes_project_idx      ON notes(project_id);
INDEX notes_kind_status_idx  ON notes(kind, status);
INDEX notes_updated_idx      ON notes(updated_at DESC);

chunks {
  -- Exclusivement pour kind='document'. Atoms n'ont pas de row chunks.
  id            TEXT PK                 -- uuid v4
  note_id       TEXT NOT NULL FK notes.id ON DELETE CASCADE
  position      INTEGER NOT NULL        -- 0-indexed, ordre dans le doc
  heading_path  TEXT                    -- "§ 2 — Schéma DB > 2.1 Tables" (breadcrumb H1>H2>H3)
  content       TEXT NOT NULL
  content_hash  TEXT NOT NULL
  created_at    INTEGER NOT NULL
  UNIQUE(note_id, position)
}
INDEX chunks_note_idx ON chunks(note_id);

embeddings {
  owner_type    TEXT NOT NULL           -- 'note' (atoms) | 'chunk' (docs)
  owner_id      TEXT NOT NULL
  model         TEXT NOT NULL           -- "Xenova/multilingual-e5-base"
  dim           INTEGER NOT NULL        -- 768
  content_hash  TEXT NOT NULL           -- copie du hash de l'owner au moment de l'embed
  vector        BLOB NOT NULL           -- Float32Array buffer
  created_at    INTEGER NOT NULL
  PRIMARY KEY (owner_type, owner_id, model)
}
INDEX embeddings_model_idx ON embeddings(model);

app_meta {
  key   TEXT PRIMARY KEY
  value TEXT NOT NULL
}
-- Clés utilisées : 'chunk_config_version', 'schema_version'
```

### 2.2 — View `embedding_owners` (filter-before-ranking pour semantic search)

```sql
CREATE VIEW embedding_owners AS
  SELECT
    e.owner_type, e.owner_id, e.model, e.vector, e.content_hash,
    COALESCE(n.id,         nc.id)         AS note_id,
    COALESCE(n.project_id, nc.project_id) AS project_id,
    COALESCE(n.kind,       nc.kind)       AS kind,
    COALESCE(n.status,     nc.status)     AS status,
    COALESCE(n.tags,       nc.tags)       AS tags,
    COALESCE(n.source,     nc.source)     AS source
  FROM embeddings e
  LEFT JOIN notes  n  ON (e.owner_type = 'note'  AND e.owner_id = n.id)
  LEFT JOIN chunks c  ON (e.owner_type = 'chunk' AND e.owner_id = c.id)
  LEFT JOIN notes  nc ON (e.owner_type = 'chunk' AND c.note_id  = nc.id);
```

Usage : `SELECT vector FROM embedding_owners WHERE model=? AND project_id=? AND status=?` puis cosine en mémoire sur le subset filtré seulement. Indexes sous-jacents (`chunks_note_idx`, `notes_project_idx`) couvrent.

### 2.3 — FTS5 + triggers

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  owner_type UNINDEXED,
  owner_id   UNINDEXED,
  project_id UNINDEXED,
  title,
  content,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);
```

**Règle clé** : pour les atoms, `title` FTS5 = `notes.title`. Pour les chunks, `title` FTS5 = `chunks.heading_path`. Unifié côté schéma, sémantiquement cohérent, zéro cascade lors d'un rename de doc parent.

6 triggers (INSERT/UPDATE/DELETE sur `notes` et `chunks`) + 2 triggers de cleanup embeddings orphelins :

```sql
-- Exemple INSERT pour atoms
CREATE TRIGGER notes_ai_fts AFTER INSERT ON notes WHEN NEW.kind='atom' BEGIN
  INSERT INTO notes_fts(owner_type, owner_id, project_id, title, content, tags)
  VALUES ('note', NEW.id, NEW.project_id, NEW.title, NEW.content, NEW.tags);
END;

-- Exemple INSERT pour chunks (title = heading_path)
CREATE TRIGGER chunks_ai_fts AFTER INSERT ON chunks BEGIN
  INSERT INTO notes_fts(owner_type, owner_id, project_id, title, content, tags)
  VALUES ('chunk', NEW.id,
    (SELECT project_id FROM notes WHERE id = NEW.note_id),
    COALESCE(NEW.heading_path, ''),
    NEW.content,
    (SELECT tags FROM notes WHERE id = NEW.note_id));
END;

-- Cleanup embeddings polymorphes (pas de FK possible sur une table polymorphe)
CREATE TRIGGER notes_ad_emb AFTER DELETE ON notes BEGIN
  DELETE FROM embeddings WHERE owner_type='note' AND owner_id=OLD.id;
END;
CREATE TRIGGER chunks_ad_emb AFTER DELETE ON chunks BEGIN
  DELETE FROM embeddings WHERE owner_type='chunk' AND owner_id=OLD.id;
END;
```

Sans `PRAGMA recursive_triggers = ON`, la cascade `notes → chunks → embeddings` ne se propage pas. Gotcha 10 de la § 5.

### 2.4 — Seed initial

À la première ouverture de la DB, après migrations :

```sql
INSERT INTO projects (id, slug, name, description, color, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'global',
  'Global',
  'Notes cross-projets : patterns, règles, décisions qui valent pour tous les repos.',
  '#71717a',  -- zinc-500
  strftime('%s','now')*1000,
  strftime('%s','now')*1000
);
```

Constante `GLOBAL_PROJECT_ID` exportée depuis `@agent-brain/shared`. `project_delete` refuse cet id (Zod + CHECK runtime).

### 2.5 — Content hash à trois niveaux (rationale)

- `notes.content_hash` = sha256(full markdown). Skip re-chunking si inchangé à `note_update`.
- `chunks.content_hash` = sha256(chunk.content seul). Alimente le diff-based chunk sync : une section inchangée conserve son embedding même si le doc parent a été modifié ailleurs.
- `embeddings.content_hash` = copie du hash de l'owner au moment de l'embed. Sert à détecter les embeddings stale lors d'un futur reindex.

---

## 3 — Tools MCP

12 tools. Tous validés Zod. Format de retour uniforme.

### 3.1 — Conventions de retour

```ts
// Liste
{ items: T[], total: number, limit: number, offset: number }

// Objet unique
{ item: T }

// Mutation create/update/delete
{ ok: true, id: string }             // + item?: T pour create

// Search (hits hétérogènes)
{ hits: SearchHit[], total: number, mode: 'fulltext'|'semantic'|'hybrid' }
```

Un test runtime (`tools/contracts.test.ts`) valide chaque handler contre son schéma de retour. Aucun `extractArray()` helper n'existera.

#### 3.1.1 — Response schemas dans `@agent-brain/shared`

Les response shapes sont des Zod schemas réutilisables, pas des simples types TS. Ça rend la contract test possible et donne un type-check end-to-end côté UI.

```ts
// packages/shared/src/schemas.ts
import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { projects, notes, chunks } from '@agent-brain/mcp/db/schema';

// Entity schemas — dérivés de Drizzle, zéro duplication
export const ProjectSchema = createSelectSchema(projects);
export const NoteSchema    = createSelectSchema(notes).extend({
  tags: z.array(z.string()),   // override: parsed JSON array, pas le string brut
});
export const ChunkSchema   = createSelectSchema(chunks);

export const SearchHitSchema = z.object({
  owner_type: z.enum(['note', 'chunk']),
  owner_id:   z.string().uuid(),
  score:      z.number(),
  score_fts:  z.number().optional(),
  score_sem:  z.number().optional(),
  snippet:    z.string(),
  parent: z.object({
    note_id:    z.string().uuid(),
    title:      z.string(),
    kind:       z.enum(['atom', 'document']),
    project_id: z.string().uuid(),
    tags:       z.array(z.string()),
    status:     z.enum(['draft', 'active', 'archived', 'deprecated']),
  }),
  chunk: z.object({
    heading_path: z.string(),
    position:     z.number().int(),
    neighbors:    z.array(z.object({ position: z.number().int(), content: z.string() })),
  }).optional(),
});

// Response envelope factories
export const ListResponseSchema = <T extends z.ZodTypeAny>(item: T) => z.object({
  items:  z.array(item),
  total:  z.number().int().nonnegative(),
  limit:  z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const ItemResponseSchema = <T extends z.ZodTypeAny>(item: T) => z.object({ item });

export const MutationResponseSchema = <T extends z.ZodTypeAny>(item?: T) => z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
  item: item ? item.optional() : z.unknown().optional(),
});

export const SearchResponseSchema = z.object({
  hits:  z.array(SearchHitSchema),
  total: z.number().int().nonnegative(),
  mode:  z.enum(['fulltext', 'semantic', 'hybrid']),
});

export type Project    = z.infer<typeof ProjectSchema>;
export type Note       = z.infer<typeof NoteSchema>;
export type Chunk      = z.infer<typeof ChunkSchema>;
export type SearchHit  = z.infer<typeof SearchHitSchema>;
```

- Les handlers MCP parsent leur retour via ces schemas dans les tests `tools/contracts.test.ts` (runtime guarantee).
- L'UI importe les `Project` / `Note` / `Chunk` types depuis `@agent-brain/shared` — plus jamais de réécriture manuelle d'interfaces.
- Le `notes.tags` qui est TEXT (JSON array) en DB est transformé en `string[]` via l'override de `NoteSchema`. Les handlers MCP sont responsables du `JSON.parse()` au read et du `JSON.stringify()` au write. Tests dédiés dans `db/serialization.test.ts`.

### 3.2 — Projects (4 tools)

```ts
project_create({
  slug:        z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(64),
  name:        z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  repo_path:   z.string().optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
// → { ok, id, item: Project }
// Consommé par le futur skill Claude Code /onboarding.

project_list({
  limit:  z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})
// → { items: Project[], total, limit, offset }

project_update({
  id:    z.string().uuid(),
  patch: z.object({ name, description, repo_path, color }).partial(),
})
// → { ok, id, item }

project_delete({
  id: z.string().uuid().refine(id => id !== GLOBAL_PROJECT_ID, 'cannot delete global project'),
  reassign_notes_to: z.string().uuid().default(GLOBAL_PROJECT_ID),
})
// → { ok, id, reassigned_count: number }
// Par défaut les notes du projet supprimé migrent vers 'global'.
```

### 3.3 — Notes (5 tools)

```ts
note_create({
  project_id: z.string().uuid(),          // NOT NULL, 'global' par convention cross-projet
  kind:       z.enum(['atom', 'document']),
  title:      z.string().min(1).max(200),
  content:    z.string().min(1),
  tags:       z.array(z.string().min(1).max(40)).max(20).default([]),
  status:     z.enum(['draft', 'active', 'archived', 'deprecated']).default('active'),
  source:     z.enum(['ai', 'human', 'import']),
})
// → { ok, id, item: Note }
//
// Handler synchrone :
//   1. INSERT notes avec content_hash
//   2. Si kind='atom' → embedPassage(content), INSERT embeddings row
//   3. Si kind='document' → chunk(), pour chaque chunk : INSERT chunks, embedPassage, INSERT embeddings
//   4. FTS5 auto via triggers
//
// ⚠ Latence pour kind='document' : ~200ms × nombre de chunks. Au-delà de ~20 chunks, >3s.
// Si ça devient un problème UX, ajouter un mode async avec polling.
//
// Pas de `note_create_bulk` tool : l'UI import zone appelle `note_create` en boucle séquentielle
// côté client, ce qui donne une progress bar temps réel gratuite (1 appel = 1 tick) sans streaming
// HTTP ni SSE. Un tool bulk MCP serait un appel HTTP atomique qui ne retourne qu'à la fin, donc
// inutile pour l'UX. YAGNI.

note_get({ id: z.string().uuid() })
// → { item: Note & { chunks?: Chunk[] } }  // chunks triés par position, inclus si kind='document'

note_update({
  id:    z.string().uuid(),
  patch: z.object({
    project_id: z.string().uuid(),
    title:      z.string().min(1).max(200),
    content:    z.string().min(1),
    tags:       z.array(z.string().min(1).max(40)).max(20),
    status:     z.enum(['draft', 'active', 'archived', 'deprecated']),
  }).partial(),
})
// → { ok, id, item }
//
// Logique skip-if-unchanged :
//   - patch.content absent OU nouveau hash === ancien hash → pas de re-chunk, pas de re-embed
//   - sinon :
//       - kind='atom' : regen 1 embedding
//       - kind='document' : diff-based chunk sync (§ 3.3.1)

note_delete({ id: z.string().uuid() })
// → { ok, id }
// ON DELETE CASCADE chunks + triggers embeddings orphelins.

note_list({
  project_id: z.string().uuid().optional(),                              // undefined = tous projets
  kind:       z.enum(['atom', 'document']).optional(),
  status:     z.enum(['draft', 'active', 'archived', 'deprecated']).optional(),
  tags_any:   z.array(z.string()).optional(),                            // OR
  tags_all:   z.array(z.string()).optional(),                            // AND
  source:     z.enum(['ai', 'human', 'import']).optional(),
  sort:       z.enum(['updated_desc', 'created_desc', 'title_asc']).default('updated_desc'),
  limit:      z.number().int().min(1).max(200).default(50),
  offset:     z.number().int().min(0).default(0),
}).refine(o => !(o.tags_all && o.tags_any), 'tags_all and tags_any are mutually exclusive')
// → { items: Note[], total, limit, offset }
```

#### 3.3.1 — Diff-based chunk sync (algorithme)

Appelé par `note_update` quand `content` change pour un doc. Pseudocode :

```ts
async function syncDocumentChunks(noteId: string, newContent: string) {
  const newChunks = chunk(newContent);                            // C light (§ 2.4 chunking)
  const oldChunks = db.select().from(chunks).where(eq(chunks.noteId, noteId));
  const oldByHash = new Map(oldChunks.map(c => [c.contentHash, c]));

  for (const nc of newChunks) {
    const reused = oldByHash.get(nc.contentHash);
    if (reused) {
      // content identique → UPDATE position/heading_path uniquement, embedding intact
      db.update(chunks)
        .set({ position: nc.position, headingPath: nc.headingPath })
        .where(eq(chunks.id, reused.id));
      oldByHash.delete(reused.contentHash);
    } else {
      // nouveau ou modifié → INSERT + embed
      const id = crypto.randomUUID();
      db.insert(chunks).values({ id, noteId, ...nc });
      const vec = await embedPassage(nc.content);
      db.insert(embeddings).values({
        ownerType: 'chunk', ownerId: id,
        model: CHUNK_CONFIG.model, dim: 768,
        contentHash: nc.contentHash, vector: toBuffer(vec),
      });
    }
  }
  // Chunks restants dans oldByHash = obsolètes → DELETE (cascade trigger nettoie embeddings)
  const toDelete = [...oldByHash.values()].map(c => c.id);
  if (toDelete.length) db.delete(chunks).where(inArray(chunks.id, toDelete));
}
```

Cas concret : édition d'1 paragraphe dans 1 section d'un doc à 30 sections → 1 INSERT + 1 embed + 1 DELETE + UPDATE positions. ~200-400ms au lieu de 6s en delete+reinsert naïf.

### 3.4 — Search (1 tool unifié)

```ts
search({
  query:      z.string().min(1).max(500),
  mode:       z.enum(['fulltext', 'semantic', 'hybrid']).default('hybrid'),
  project_id: z.string().uuid().optional(),
  kind:       z.enum(['atom', 'document']).optional(),
  status:     z.enum(['draft', 'active', 'archived', 'deprecated']).optional(),
  source:     z.enum(['ai', 'human', 'import']).optional(),
  tags_any:   z.array(z.string()).optional(),
  tags_all:   z.array(z.string()).optional(),
  limit:      z.number().int().min(1).max(50).default(10),
  neighbors:  z.number().int().min(0).max(3).default(1),
}).refine(o => !(o.tags_all && o.tags_any), 'tags_all and tags_any are mutually exclusive')
// → { hits: SearchHit[], total, mode }

type SearchHit = {
  owner_type: 'note' | 'chunk';
  owner_id:   string;
  score:      number;               // normalisé [0..1]
  score_fts?: number;                // bm25, si mode ∈ {fulltext, hybrid}
  score_sem?: number;                // cosine, si mode ∈ {semantic, hybrid}
  snippet:    string;                // FTS5 snippet() highlight
  parent: {
    note_id:    string;
    title:      string;
    kind:       'atom' | 'document';
    project_id: string;
    tags:       string[];
    status:     'draft' | 'active' | 'archived' | 'deprecated';
  };
  chunk?: {                          // seulement si owner_type='chunk'
    heading_path: string;
    position:     number;
    neighbors: { position: number; content: string }[];   // ± N sections, content tronqué ~300 chars
  };
};
```

**Décisions :**

1. **Un seul tool, mode paramétré.** Pas de split `search_fulltext` / `search_semantic` comme Barda.
2. **Hybrid par défaut, via RRF** : `score = Σ 1/(k + rank_i)` avec `k = 60`. Zéro magic number à tuner.
3. **Fulltext** : FTS5 `MATCH` avec BM25, JOIN `notes` pour filtres **avant** ranking.
4. **Semantic** : SELECT sur la view `embedding_owners` avec filtres en WHERE → cosine naïve sur le subset filtré seulement. Pas de full-scan des embeddings.
5. **Filter-before-ranking cohérent sur les 3 modes.**
6. **Neighbor expansion** : quand un chunk matche, charger les chunks `position ± 1..N` du même `note_id`, content tronqué à ~300 chars. Gratuit, énorme gain de contexte pour l'appelant IA.
7. **Tags filtering dans le WHERE** via `json_each()` (pas de post-filter JS). Un `tags` JSON array contient ≤20 éléments, `json_each()` est O(n) trivial à cette échelle et garantit que `limit` reflète vraiment `limit` hits matchant. Un post-filter JS produirait des retours partiels (<limit) dès que le tag est rare — bug utilisateur inacceptable. Cohérent avec la règle "filter-before-ranking sur les 3 modes".

```sql
-- Pattern réutilisé pour fulltext, semantic, et note_list
AND (? IS NULL OR EXISTS (
  SELECT 1 FROM json_each(eo.tags) WHERE json_each.value IN (...tags_any)
))
AND (? IS NULL OR NOT EXISTS (
  SELECT 1 FROM (VALUES ...tags_all) AS required(tag)
  WHERE NOT EXISTS (SELECT 1 FROM json_each(eo.tags) WHERE json_each.value = required.tag)
))
```

8. **Parité de filtres avec `note_list`** : `source` est filtrable dans `search` (comme `note_list`). Pas de drift entre les deux tools.

### 3.5 — Maintenance (2 tools + 1 script CLI)

```ts
backup_brain({
  label: z.string().max(64).optional(),
})
// → { ok, path: string, size_bytes: number }
// 1. PRAGMA wal_checkpoint(TRUNCATE)
// 2. fs.copyFileSync vers ~/.agent-brain/backups/<ts>-<label>.db
// Read-safe : un autre process peut continuer à écrire pendant le checkpoint+copy WAL.
// ⚠ Bloquant sur grosses DB (>500MB). Acceptable au MVP.

get_stats({
  project_id: z.string().uuid().optional(),   // si fourni, stats scopées au projet
})
// → { item: Stats }

type Stats = {
  projects: number;
  notes: { total: number; by_kind: Record<'atom'|'document', number>;
           by_status: Record<string, number>; by_source: Record<string, number> };
  chunks: { total: number; avg_per_doc: number };
  embeddings: { total: number; by_owner_type: Record<string, number>; model: string };
  db_size_bytes: number;
  top_tags: { tag: string; count: number }[];  // top 10
};
```

**`restore_brain` n'est PAS un tool MCP** — c'est un script CLI `pnpm mcp:restore <path>`. Raison : restaurer une DB implique un `close() + fs.copyFile() + reopen()`, opération incompatible avec un autre process MCP qui tiendrait une transaction ouverte sur le même fichier (corruption garantie). Un script CLI force l'utilisateur à fermer manuellement UI + Claude Code avant de l'exécuter, et une sentinelle `~/.agent-brain/restore.lock` vérifiée au boot de tout process MCP bloque toute ouverture de DB pendant un restore en cours. C'est une opération d'urgence, pas un flow quotidien — la retirer des tools MCP élimine un risque de corruption par appel accidentel depuis une IA.

### 3.6 — Hors MVP explicitement

- `detect_duplicates` : à ajouter quand assez de notes pour que les doublons soient un vrai problème (≥ quelques centaines).
- `reindex_chunks` : uniquement comme script CLI `pnpm mcp:reindex`, **pas** comme tool MCP exposé (évite un drop accidentel par une IA).
- `export_markdown` : YAGNI.
- `list_backups` : `ls ~/.agent-brain/backups/` existe.
- `note_archive` / `note_restore` / `note_duplicate` : ce sont des `note_update({ patch: { status } })` ou `note_create` — pas de sucre.

---

## 4 — Chunking (C light)

### 4.1 — Algorithme

1. Parser le Markdown **via un AST** (`unified` + `remark-parse` + `remark-gfm`), walk l'arbre et split sur les nœuds `heading` de `depth <= 3` **exclusivement**. Les `#` à l'intérieur de nœuds `code` (fenced blocks) ou `inlineCode` sont ignorés structurellement — jamais matchés par regex. C'est **obligatoire** : agent-brain archive des specs techniques bourrées de code fenced contenant des `#` (commentaires SQL, directives C, etc.), et un chunker regex naïf splitterait au milieu des fences, générant des chunks avec code blocks non fermés et des `heading_path` corrompus.
2. Pour chaque section résultante :
   - Compter les tokens via **le tokenizer E5 lui-même** (`AutoTokenizer.from_pretrained('Xenova/multilingual-e5-base')`), jamais via `gpt-tokenizer` ni regex.
   - Si `tokenCount(section) <= 450` → chunk final.
   - Sinon → split par paragraphe (`\n\n`), packing greedy jusqu'à ≤ 450 tokens.
   - Si un paragraphe seul dépasse 450 tokens → split par phrase (regex simple), et logger un warning `"paragraph exceeds 450 tokens in note <id>, section <heading>"`.
3. Chaque chunk reçoit :
   - `position` (0-indexé, ordre d'apparition)
   - `heading_path` (breadcrumb reconstruit depuis la pile de headers, ex: `"§ 2 — Schéma DB > 2.1 Tables"`)
   - `content_hash` (sha256 du `content` seul)

### 4.2 — Constante de configuration

```ts
// packages/mcp/src/embeddings/chunking.ts
export const CHUNK_CONFIG = {
  version: 1,
  maxTokens: 450,                             // marge contre les 512 E5-base theoretical
  model: 'Xenova/multilingual-e5-base',
  strategy: 'remark-ast-headers+paragraph+sentence-fallback',
} as const;
```

Stockée dans `app_meta` au boot. Si le code bump `version`, le MCP log un warning `"chunk config changed, run pnpm mcp:reindex"`. Reindex manuel volontaire — jamais automatique.

### 4.3 — Embeddings E5 — préfixes obligatoires

Wrapper dans `embeddings/index.ts` :

```ts
export async function embedPassage(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const out = await pipe('passage: ' + text, { pooling: 'mean', normalize: true });
  return out.data;
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const out = await pipe('query: ' + text, { pooling: 'mean', normalize: true });
  return out.data;
}
```

**Impossible** d'appeler `pipeline()` directement depuis les tools. Les préfixes `passage:` / `query:` sont **obligatoires** avec E5 (asymétrie), sinon le recall dégrade de ~15 %.

### 4.4 — Lazy load et preload

- `getEmbeddingPipeline()` est mémoïsée, mais le premier call charge ~200 MB de poids ONNX → 5-10s.
- En mode `--ui`, après `app.listen()`, fire-and-forget `getEmbeddingPipeline().catch(() => {})`. L'utilisateur navigue dans la sidebar pendant que le modèle charge.
- Endpoint `/health` expose `{ embedder_ready: boolean }`. L'UI affiche un "Chargement du modèle…" discret tant que `false`.
- En mode stdio, pas de preload — la latence est masquée par le contexte IA. **UX tax à noter** : le premier `note_create` d'une session Claude Code bloque 5-10 secondes sans feedback utilisateur visible (l'IA attend l'outil, silencieuse). Acceptable au MVP parce que l'auto-archive arrive en fin de session, pas au milieu d'un flow interactif. Si un futur usage "capture temps réel pendant une conversation" émerge, on ajoutera un preload stdio opt-in.

---

## 5 — UI web

**Stack** : React 19, Vite, Tailwind 4, TanStack Query, React Router 7, shadcn/ui (Card, Button, Input, Dialog, Sheet, Badge, ScrollArea, Command, Tabs, Textarea), lucide-react, Geist Sans/Mono, design system `erom-design` dark-first (oklch zinc/neutral + 1 accent).

### 5.1 — Layout

- **Sidebar 260px, collapsible** : logo + bouton ⌘K search + liste projects + activité récente (5 dernières notes tous projects) + lien Stats.
- **Main content** : outlet de React Router.
- Dark-first. Pas de toggle light/dark au MVP.

### 5.2 — Routes

```
/                            → redirect /dashboard
/dashboard                   → Dashboard (activité récente, top tags, stats compact)
/projects/:slug              → ProjectView (header, toolbar, filtres, NoteList, import zone)
/projects/:slug/notes/:id    → NoteDetail (lecture + édition inline, rendu chunk-by-chunk pour docs)
/projects/:slug/notes/new    → NoteEditor (création)
/search?q=...&mode=hybrid    → SearchResults (alternative page à la Command palette)
/settings                    → Stats détaillées + backup/restore UI
```

Pas de `/projects` (liste) : la sidebar fait le job.

### 5.3 — Command palette ⌘K

Composant central basé sur shadcn `<Command>`. Point d'entrée principal pour la consultation (80 % des usages attendus).

- Input + debounce 200ms → `search({ mode: 'hybrid', limit: 8 })`.
- Icônes différenciées : 📄 atom, 📑 document, 🧩 chunk (avec `heading_path` en sous-titre).
- Tab pour switch `Hybrid / Sémantique / Full-text`.
- Enter → navigate. Pour un hit chunk, URL inclut `#chunk-${id}`, le NoteDetail scrolle à l'ancre.
- Groupe "Actions" (+ Nouvelle note, + Nouveau projet, Voir stats) et groupe "Projects" (navigation rapide).
- Lookup slug depuis le cache TanStack Query : `queryClient.getQueryData<Project[]>(['projects']).find(p => p.id === hit.parent.project_id)`. O(1), zéro fetch supplémentaire (la sidebar précharge déjà).

### 5.4 — NoteDetail — rendu chunk-by-chunk pour docs

**Critique** : un doc en mode lecture n'est **pas** rendu depuis `notes.content` monolithique. Il est assemblé chunk par chunk :

```tsx
function DocumentView({ note }: { note: Note & { chunks: Chunk[] } }) {
  const sorted = [...note.chunks].sort((a, b) => a.position - b.position);
  return (
    <article>
      {sorted.map(chunk => (
        <section key={chunk.id} id={`chunk-${chunk.id}`} data-heading={chunk.headingPath}>
          <MarkdownView source={chunk.content} />
        </section>
      ))}
    </article>
  );
}
```

Conséquences :

- Chaque chunk a une ancre DOM stable `#chunk-${id}` → les hits search scrollent précisément.
- Le TOC "Sections" itère sur les mêmes `chunks` → cohérence par construction.
- **Édition** : bascule sur `notes.content` monolithique dans un `<Textarea>`, Ctrl+S → `note_update({ content })`. Le diff-based chunk sync reconstruit les chunks côté MCP. L'utilisateur n'édite jamais les chunks directement.
- Atoms : rendu direct `<MarkdownView source={note.content} />`, pas de section wrapper.

**Limitation assumée — deep-links `#chunk-${id}` stale après édition** : le diff-based chunk sync (§ 3.3.1) préserve les UUIDs des chunks inchangés, donc un deep-link vers une section stable continue de fonctionner. Mais un chunk modifié reçoit un nouveau UUID, et un bookmark externe pointant vers l'ancien UUID scrolle silencieusement vers nulle part. Au MVP, c'est acceptable : les hits search sont générés à la volée (pas stockés), le seul cas où un bookmark survit est un partage manuel entre sessions. Ancrer sur `chunk.position` serait pire (faux positifs quand des sections sont réordonnées).

### 5.5 — Import zone (flow humain principal)

Onglet "Importer" dans le header d'un ProjectView. Deux modes :

1. **Paste zone** : textarea plein cadre. Détection heuristique "dump Apple Notes" (1ère ligne courte + blank line → pré-remplit `title` = 1ère ligne, `content` = reste). Kind radio (atom/document). Tags input. Source fixée à `'import'`. Bouton "Indexer maintenant" → `note_create`.
2. **Drag & drop fichiers .md** : **max 10 fichiers** en bloquant. Au-delà, alert inline `"Plus de 10 fichiers à la fois. Utilise la zone paste pour les gros dumps."`. Boucle `note_create` côté client séquentielle (pas de parallélisme — l'E5-base explose la RAM à plusieurs embeddings concurrents), update la progress bar à chaque item. Un échec sur un fichier marque l'item en erreur mais continue le batch. Feedback temps réel gratuit.

### 5.6 — Composants transverses

```
components/
├── NoteCard.tsx          ligne de liste, 1 note (atoms + docs)
├── NoteEditor.tsx        textarea + tabs preview, debounced save
├── MarkdownView.tsx      react-markdown + remark-gfm + rehype-highlight, config centralisée
├── TagChip.tsx           badge cliquable (toggle filter dans l'URL search params)
├── ProjectBadge.tsx      nom + color dot
├── KindBadge.tsx         "atom" / "doc"
├── StatusBadge.tsx       "active" / "draft" / "archived" / "deprecated"
├── SourceBadge.tsx       "ia" / "humain" / "import"
├── SearchHit.tsx         1 ligne de résultat (Command + /search)
├── Sidebar.tsx           layout root
├── ImportZone.tsx        paste + drop
└── EmptyState.tsx        générique
```

### 5.7 — API layer

```
src/api/
├── mcp-client.ts         fetch POST /mcp, typed, ~40 lignes
├── tools/                 1 fichier par groupe de tools (projects, notes, search, maintenance)
└── hooks/
    ├── useProjects.ts    useQuery + useMutation + invalidate
    ├── useNotes.ts
    ├── useSearch.ts      debounced, keepPreviousData
    └── useStats.ts
```

`refetchOnWindowFocus: true` sur `notes` et `stats` pour refléter les écritures IA entre deux sessions Claude Code sans effort. Lag typique 1-2s, acceptable au MVP. Upgrade possible : SSE `/events` qui push des invalidations TanStack Query (~30 lignes).

### 5.8 — Hors UI MVP

- Graph Sigma, timeline, CodeMirror/Monaco, éditeur WYSIWYG, drag & drop inter-projets, bulk actions multi-sélection, undo/redo, toggle light/dark, auth, i18n.

---

## 6 — Tests, build, packaging

### 6.1 — Tests (Vitest, cible ~80 tests)

**Test DB** : chaque suite boot une fresh `:memory:`, apply migrations Drizzle, seed `global`, run, discard. Parallélisé via vitest threads. Setup global mock le pipeline HF (cf. 6.1.1).

**Suites obligatoires MCP** :

- `embeddings/chunking.test.ts` (~17) — C light via AST remark, token count via **vrai tokenizer E5**, `heading_path` reconstruit, `position` strictement croissant, `content_hash` déterministe, edge cases (doc vide, sans headers, paragraphes géants). **Tests spécifiques AST** : (1) un doc avec code fenced SQL contenant des `-- # commentaires` n'est pas splitté sur ces `#` ; (2) invariant `chunks.map(c => c.content).join('') ≈ notes.content` à whitespace près ; (3) inlineCode avec `#hashtag` non interprété.
- `notes/sync-chunks.test.ts` (~10) — **critique**. Diff-based sync : 1-paragraphe-modifié, rename section, ajout/suppression, refactor massif. Invariant `count(chunks) == count(embeddings[chunk])`.
- `search/hybrid.test.ts` (~8) — RRF, filter-before-ranking, `tags_all` vs `tags_any`, neighbor expansion, refus `tags_all + tags_any`.
- `tools/contracts.test.ts` (~8) — chaque handler validé runtime contre son response shape Zod.
- `db/backup.test.ts` (~5) — WAL checkpoint, restore propre, cleanup `.db-wal`/`.db-shm`, rollback sur corrompu.
- `db/cascade.test.ts` (~6) — delete atom, delete doc → triggers embeddings cascade, invariant pas d'orphelins, idempotence.
- `tools/projects.test.ts` (~6) — `project_delete` refuse global, réassignation par défaut, slug unique, seed global au boot.
- `db/serialization.test.ts` (~4) — `notes.tags` JSON round-trip, `NoteSchema` parse correctement, write stringify, reject malformed JSON.

**Suites UI** (~20) : debounce `useSearch`, Ctrl+S dans `NoteEditor`, `MarkdownView` résilient (fuzz 5), Sidebar highlight active, Command navigation clavier, ImportZone rejette >10, TagChip sync URL.

**Explicitement hors tests MVP** : perf benchmarks, E2E Playwright, coverage avec le vrai modèle E5 (200 MB mock obligatoire), visual regression.

#### 6.1.1 — Mock embeddings

```ts
// packages/mcp/tests/_helpers/mock-embeddings.ts
import { createHash } from 'node:crypto';

export function mockEmbed(text: string): Float32Array {
  const seed = createHash('sha256').update(text).digest();      // 32 bytes
  const raw = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    raw[i] = (seed[i % 32] / 127.5 - 1) * (1 + (i % 7) * 0.03);
  }
  let norm = 0;
  for (const v of raw) norm += v * v;
  norm = Math.sqrt(norm);
  for (let i = 0; i < 768; i++) raw[i] /= norm;
  return raw;
}
```

Propriétés garanties : 768d, L2-normalized, déterministe, distinct par input. Sans ça les tests RRF sont flaky ou ne testent rien. Mock appliqué globalement dans `tests/setup.ts`, aucun bypass autorisé.

**Caveat** : le facteur `(1 + (i % 7) * 0.03)` introduit une légère corrélation structurelle entre embeddings qui garantit `cosine(a, b) > 0.3` pour deux inputs distincts. C'est voulu pour tester des **rangs relatifs** (RRF, top-K order) de manière stable, mais **ne pas utiliser `mockEmbed` pour tester des seuils cosine absolus** (ex: "deux inputs non liés sont quasi-orthogonaux"). Ce genre de test nécessiterait soit le vrai modèle, soit un mock dédié sans corrélation — hors MVP.

### 6.2 — Build & packaging

- **`@agent-brain/mcp`** : build tsup → CJS + ESM + .d.ts + shebang CLI. `bin: { "agent-brain": "dist/index.js" }`. Publication npm **non au MVP** (YAGNI, installation locale via chemin absolu).
- **`@agent-brain/ui`** : build vite → `packages/mcp/public/`. tsup n'inclut pas ces assets (servis statiquement par Express).
- **`@agent-brain/shared`** : pas de build. `main: src/index.ts`, `types: src/index.ts`. Workspace protocol `"@agent-brain/shared": "workspace:*"`, TS résout directement.
- **Root package.json** : `name: "agent-brain-workspace"` (évite collision pnpm avec les scopes enfants).

**Scripts root** :

```json
{
  "scripts": {
    "dev":       "concurrently -n mcp,ui -c blue,magenta \"pnpm --filter @agent-brain/mcp dev\" \"pnpm --filter @agent-brain/ui dev\"",
    "build":     "pnpm --filter @agent-brain/ui build && pnpm --filter @agent-brain/mcp build",
    "test":      "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "mcp:reindex": "node packages/mcp/dist/scripts/reindex.js"
  }
}
```

**Config Claude Code** (à documenter dans README) :

```json
{
  "mcpServers": {
    "agent-brain": {
      "command": "node",
      "args": ["/Users/recarnot/dev/agent-brain/packages/mcp/dist/index.js"]
    }
  }
}
```

### 6.3 — Table des gotchas — 14 entrées, à grepper dès le jour 1

| # | Gotcha | Prévention |
|---|---|---|
| 1 | Express 5 route wildcard | `app.get('/{*path}', ...)` — jamais `'*'` |
| 2 | Formats retour tools incohérents | Zod `ResponseShapes` partagé + test runtime contracts |
| 3 | camelCase ↔ snake_case drift | `@agent-brain/shared` avec types inférés Drizzle, importés côté UI. Aucune interface réécrite à la main. |
| 4 | WAL + backup données fantômes | Helper `checkpointAndCopy()` dans `db/backup.ts`, utilisé systématiquement |
| 5 | HuggingFace pipeline type union | `@ts-expect-error` documenté sur l'appel `pipeline('feature-extraction', MODEL)` |
| 6 | pnpm workspace name collision | Root `package.json` name = `agent-brain-workspace` (pas `@agent-brain/*`) |
| 7 | Zod limits incohérents | Constantes dans `@agent-brain/shared/limits.ts`. Jamais de literal inline dans les tools. |
| 8 | E5 préfixes obligatoires | Wrapper `embedPassage()` / `embedQuery()`. Impossible d'appeler `pipeline()` directement. |
| 9 | Tokenizer silently truncate >512 | `chunk()` cap à 450 tokens, count via **le vrai tokenizer E5** uniquement. Test fuzz 50 inputs. |
| 10 | `recursive_triggers = OFF` par défaut | `PRAGMA recursive_triggers = ON` au boot, **avant** toute query. Sinon cascade embeddings cassée. |
| 11 | Multi-process `SQLITE_BUSY` (UI + Claude Code stdio concurrents) | Pragmas `journal_mode=WAL` + `busy_timeout=5000` systématiques via helper `openDatabase()` centralisé. |
| 12 | Tokenizer mismatch (gpt-tokenizer ≠ E5) | `AutoTokenizer.from_pretrained('Xenova/multilingual-e5-base')` exclusivement. `gpt-tokenizer` interdit dans `chunking.ts`. |
| 13 | Lazy load E5 (5-10s au premier call) | En mode `--ui`, après `app.listen()`, fire-and-forget `getEmbeddingPipeline().catch(() => {})`. Endpoint `/health` expose `embedder_ready`. |
| 14 | Chunker Markdown regex casse les fenced code blocks | Parser via **AST** (`unified` + `remark-parse` + `remark-gfm`), split uniquement sur les nœuds `heading` de `depth<=3`. Les `#` à l'intérieur de `code`/`inlineCode` sont ignorés structurellement. Test invariant `chunks.map(c => c.content).join('') ≈ notes.content` (à whitespace près) sur un doc avec code fenced. |

Cette table est référencée dans `CLAUDE.md` racine du repo.

### 6.4 — Hors MVP build

CI/CD, releases auto, semver rigoureux, Docker, telemetrie. Projet local solo.

---

## 7 — Flows UX clés

1. **Consultation rapide (80 % des usages)** : ⌘K → tape 2 mots → Enter sur un hit → lit.
2. **Capture humaine depuis Apple Notes** : UI → sidebar projet cible → onglet Importer → paste → "Indexer".
3. **Review hebdo** : `/dashboard` → activité récente → clique → archive via menu `⋯`.
4. **Auto-archive IA (depuis Claude Code)** : pas d'UI. Le futur skill `/session-end` appelle `note_create` via stdio MCP. L'UI reflète au prochain refresh (`refetchOnWindowFocus`).
5. **Démarrage nouveau projet** : Claude Code `/onboarding` → `project_create` via MCP → apparaît dans la sidebar au prochain refresh.

---

## 8 — Ce que le MVP ne fait PAS (et quand ça pourrait arriver)

| Feature | Trigger pour l'ajouter |
|---|---|
| Graph Sigma | Besoin visuel d'explorer les relations note ↔ note émerge |
| Timeline | Usage concret identifié (pas à spéculer) |
| `detect_duplicates` | Corpus > quelques centaines de notes avec plaintes réelles |
| `export_markdown` | Un 2ᵉ outil demande à consommer les données |
| Async `note_create` job queue | Latence bulk > 10s ressentie comme bloquante |
| SSE `/events` invalidation | Lag `refetchOnWindowFocus` ressenti comme gênant |
| CodeMirror | Édition de doc > 1000 lignes devient laggy |
| Multi-sélection bulk actions | Besoin d'archiver N notes d'un coup récurrent |
| Auth / déploiement distant | Besoin mobile réel (pas juste théorique) |
| CI/CD, publication npm | 2ᵉ humain utilise l'outil |

---

## 9 — Prochaines étapes

1. Review de ce spec par Romain.
2. Fork structure `packages/` de Barda en template, adapter aux 3 packages décrits.
3. Écriture du plan d'implémentation via `superpowers:writing-plans`, découpé en étapes avec checkpoints (migrations DB → embeddings wrapper → chunking → tools CRUD → search → UI layout → UI pages → tests).
4. Implémentation itérative en suivant le plan.
5. Création du skill Claude Code `/onboarding` (**hors repo agent-brain**, dans `~/.claude/`) une fois les tools `project_create` + `note_create` fonctionnels.
