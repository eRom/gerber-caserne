# ADN de Barda Bible — compte rendu pour agent-brain

> Source : `~/dev/barda-mcp-ecrivain-bible/`
> Date : 2026-04-08
> But : extraire les décisions archi réutilisables pour agent-brain, avant brainstorm.

---

## 1. Résumé en une phrase

**Un serveur MCP monorepo (stdio + HTTP) qui expose la même base SQLite à deux consommateurs : des agents IA (outils MCP JSON-RPC) et un humain (UI web React servie par le même process Express).**

C'est la forme à cloner pour agent-brain. Le reste (entités narratives) est spécifique écrivain.

---

## 2. Stack concrète (ce qu'on garde probablement tel quel)

| Couche | Techno | Pourquoi c'est un bon choix |
|---|---|---|
| Runtime | Node.js ≥20, TypeScript strict | Ecosystème MCP natif, tsx en dev |
| MCP SDK | `@modelcontextprotocol/sdk` v1.28+ | API haut niveau `server.tool(name, desc, zodSchema, handler)` |
| HTTP | Express 5 + JSON-RPC maison | ~70 lignes, appel direct des handlers (pas le transport SDK) |
| DB | `better-sqlite3` + `drizzle-orm` | Synchro, prepared statements, WAL, FK |
| Full-text | SQLite **FTS5** avec triggers | Sync auto INSERT/UPDATE/DELETE, `snippet()` highlight |
| Embeddings | `@huggingface/transformers` (ONNX local) | Zero cloud, modèle téléchargé au 1er run |
| Modèle embed | `Xenova/multilingual-e5-base` | **768d**, multilingue, prefix `passage:` / `query:` |
| Packaging | `pnpm workspaces` + `tsup` (MCP) + `vite` (UI) | MCP publiable sur npm, UI buildée et copiée dans `packages/mcp/public/` |
| Validation | Zod sur chaque tool input | SDK convertit auto en JSON Schema |
| Tests | `vitest` | 90 tests (61 MCP + 29 UI), DB `:memory:` pour MCP |

**UI stack** : React 19, Tailwind 4, TanStack Query (pas de store global), React Router 7, **Sigma.js + graphology** (graph WebGL), **Lucide icons**. Design system oklch hérité de Cruchot.

---

## 3. Le pattern clé : "un process, deux interfaces"

```
                    ┌──────────────────────────────┐
                    │   packages/mcp/src/index.ts  │
                    │   parse --ui / --db-path     │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
        (--ui absent)                    (--ui présent)
              │                                 │
              ▼                                 ▼
      McpServer stdio                  Express 127.0.0.1
      (pour agents IA)                 POST /mcp → tools
                                       GET  /*   → UI statique
                                       (auto-open browser)
```

**Le coup de génie** : en mode `--ui`, Express NE RÉUTILISE PAS le transport MCP du SDK. Il lit `mcpServer._registeredTools` (privé TS mais public au runtime) et route le JSON-RPC directement vers les handlers. Économie d'une couche, debug trivial, et la même fonction `tool()` sert les deux mondes.

Conséquence : **une seule définition de tool dessert stdio (Claude Desktop/Cursor) ET l'UI web**. Zéro duplication.

---

## 4. Schéma DB — ce qu'il faut comprendre pour transposer

Barda a 8 tables :
- 7 tables "entités" (characters, locations, events, interactions, world_rules, research, notes)
- 1 table `embeddings` **séparée** (entity_type + entity_id + BLOB + content_hash)

**Décisions réutilisables pour agent-brain** :

1. **Embeddings dans une table séparée**, pas une colonne BLOB sur chaque table entité. Permet de changer de modèle sans migrer 7 schémas, et de re-indexer par lot.

2. **`content_hash` SHA-256** : `indexEntity()` skip la regénération si le hash est identique. **Crucial** pour un watcher temps-réel qui relance l'ingestion à chaque save Obsidian.

3. **Embeddings BLOB de Float32Array** : `Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)` → read : `new Float32Array(new Uint8Array(row.embedding).buffer)`. Compact (3KB pour 768d), rapide.

4. **Pas de `vec0` ni Qdrant**. Cosine similarity naïve en mémoire (`topK()` sur `loadAllEmbeddings()`). Scale limit : ~10k-50k entités selon RAM. Pour agent-brain (notes perso cross-projets) c'est largement suffisant.

5. **IDs UUID v4** via `crypto.randomUUID()`. Timestamps `Date.now()` millisecondes (pas secondes comme Cruchot).

---

## 5. FTS5 — le pattern trigger massif

**~230 lignes de triggers SQL dans `db/fts.ts`** : pour chaque table, 3 triggers (INSERT/UPDATE/DELETE) qui synchronisent une table virtuelle `bible_fts(entity_type, entity_id, content)`.

**Le bien** :
- Sync automatique, pas besoin de logique applicative
- Recherche unifiée multi-entités via un `MATCH` unique
- `snippet(bible_fts, 2, '<b>', '</b>', '...', 30)` pour highlight côté UI

**Le moins bien** :
- Très verbeux (230 lignes pour 7 tables → ~33 lignes/table)
- Chaque nouveau champ cherchable = modifier 2 triggers
- Pour agent-brain avec des notes Markdown libres, probablement **overkill** : on a UNE entité principale (note) avec `content` unique → 3 triggers suffisent

**Leçon pour agent-brain** : garder FTS5, mais schéma plat → bien moins de triggers.

---

## 6. Le modèle d'embeddings E5 — détails qui comptent

```ts
// Pour indexer un document
pipe("passage: " + text, { pooling: "mean", normalize: true })

// Pour une requête de recherche
pipe("query: " + text, { pooling: "mean", normalize: true })
```

Le préfixe `passage:` vs `query:` est **obligatoire** avec la famille E5 (asymétrique). Se tromper dégrade la qualité de recall de ~15%. À documenter dans agent-brain.

Alternatives à considérer au brainstorm :
- `Xenova/all-MiniLM-L6-v2` (384d, même que Cruchot) : 2x plus petit, plus rapide, pas de préfixe, mais moins bon en multilingue
- `Xenova/multilingual-e5-base` (768d, Barda) : meilleur en français, +200MB
- `Xenova/multilingual-e5-large` (1024d) : encore meilleur, +400MB, plus lent

Pour agent-brain qui brasse archi/code/gotchas en français → **E5-base reste le bon défaut**.

---

## 7. Les 47 tools MCP — typologie transposable

Répartition par catégorie (pour info, pas à recopier tel quel) :

| Catégorie | Nb tools | Transposable agent-brain ? |
|---|---|---|
| CRUD par type d'entité | ~35 (5-7 par entité x 7) | ❌ Agent-brain = 1 type (note) → CRUD unique |
| `search_fulltext` + `search_semantic` | 2 | ✅ **Copier tel quel**, s'adapte à la nouvelle table |
| `backup` / `restore` / `list_backups` | 3 | ✅ **Critique**, on reprend (checkpoint WAL inclus, voir gotcha) |
| `get_stats` | 1 | ✅ Pour dashboard UI |
| `export_markdown` / `import_bulk` | 2 | 🤔 Pertinent si on veut round-trip avec filesystem |
| `detect_duplicates` (cosine) | 1 | ✅ Très utile pour dedup des notes |
| `templates` (5 genres x 3 types) | 2 | ❌ Spécifique écriture |

**Pour agent-brain, un set initial ~12 tools suffit** :
- `note_create` / `note_get` / `note_update` / `note_delete` / `note_list`
- `search_fulltext` / `search_semantic` / `search_hybrid` (nouveau, à designer)
- `backup_brain` / `restore_brain`
- `get_stats`
- `detect_duplicates`

---

## 8. L'UI web — quoi réutiliser

**Architecture** :
- `api/mcp-client.ts` : wrapper `fetch POST /mcp` JSON-RPC → ~40 lignes
- `hooks/useMcpQuery` + `useMcpMutation` : TanStack Query wrappers avec invalidation
- `EntityForm` + `EntityList` : composants génériques CRUD (mode lecture/édition/création)
- `GraphView` : Sigma.js + graphology + ForceAtlas2 worker
- Design system Cruchot (oklch CSS vars) copié dans `globals.css`

**Ce qu'on garde sans hésiter pour agent-brain** :
- Le client MCP (`mcp-client.ts`)
- Les hooks TanStack Query
- Le design system (pour cohérence avec Cruchot / erom-design)
- Le pattern Dashboard + Search + GraphView + Detail panel

**Ce qu'on repense** :
- `EntityForm` générique CRUD → remplacer par un **éditeur Markdown** (type CodeMirror ou un simple `<textarea>` + preview), vu que les notes seront du MD libre et pas des objets structurés
- Timeline → probablement inutile (on n'a pas de chronologie narrative), remplacer par "activité récente" ou un "journal"

---

## 9. Pièges Barda à ne PAS refaire dans agent-brain

Extrait des gotchas résolus qui coûteraient 2h chacun si on les redécouvre :

1. **Express 5** : route wildcard → `app.get("/{*path}", ...)` **pas** `app.get("*", ...)`
2. **Sigma.js** : **ne jamais** nommer un attribut de nœud `type` (réservé au programme de rendu WebGL). Utiliser `entityType`.
3. **Sigma.js hooks** : `useSigma()`/`useCamera()` seulement dans des composants enfants de `<SigmaContainer>`. Sinon, passer le graph en prop.
4. **Sigma.js camera jump** : avant `sigma.refresh()`, save `camera.getState()`, replay après.
5. **Formats retour MCP non uniformes** : imposer **un seul format** dès le début (ex: `{ items: [...], total: n }`). Barda paie encore l'incohérence avec un `extractArray()` helper.
6. **camelCase vs snake_case** : Drizzle retourne camelCase, mais les types UI peuvent avoir été écrits en snake_case → checker les deux. **Standardiser sur camelCase partout dès le début.**
7. **WAL + backup** : `PRAGMA wal_checkpoint(TRUNCATE)` avant ET après restore, puis cleanup `.db-wal` / `.db-shm`. Sinon données fantômes.
8. **HuggingFace pipeline type union** : `@ts-expect-error` sur l'appel `pipeline('feature-extraction', ...)`. Bug connu lib.
9. **pnpm workspace collision** : root package et packages enfants ne doivent JAMAIS avoir le même `name`. Utiliser `@scope/nom`.
10. **Limits Zod incohérents** : certains tools ont `max(200)`, d'autres `max(500)`. Standardiser dès le début.

---

## 10. Ce qui MANQUE dans Barda pour agent-brain

Barda est une bible d'écrivain. agent-brain sera une mémoire dev cross-projets. Différences structurelles à prendre en compte :

1. **Source of truth fichiers `.md` externes** (pour qu'Obsidian les lise) : Barda est 100% DB. agent-brain aura un dossier `vault/` de `.md` bruts + un watcher qui les ingère. Nouveau composant à designer.

2. **Multi-projet / namespace** : Barda est mono-univers. agent-brain doit distinguer Cruchot / autres projets. Deux options :
   - Colonne `project` sur chaque note
   - Dossier par projet dans `vault/` + tag automatique à l'ingestion

3. **Watcher temps-réel** : besoin d'un `chokidar` qui détecte les changements dans `vault/` et réindexe (FTS5 auto + embeddings via `content_hash`). Pas dans Barda.

4. **Pas de schéma d'entité rigide** : une note agent-brain = `{ id, project, path, frontmatter, content, tags[], createdAt, updatedAt }`. Le reste est dans le frontmatter YAML parsé à l'ingestion.

5. **Hybride search** : Barda a `search_fulltext` OU `search_semantic`. agent-brain voudra **un search qui mixe les deux** (BM25 + cosine, reranking par somme pondérée ou RRF). Nouveau tool à designer.

6. **Intégration Obsidian** : le vault doit être lisible par Obsidian sans conflit. Implique : pas de fichiers `.db` dans le vault, frontmatter YAML standard, wikilinks `[[...]]` à préserver au parsing.

7. **Cycle de vie d'une note** : draft / active / archived / deprecated. Probablement un champ `status` dans frontmatter ou un dossier `archive/`.

---

## 11. Taille du projet (ordres de grandeur)

D'après les fichiers clés et .memory/ :
- **MCP package** : ~14 fichiers tools, ~8 fichiers db/embeddings, ~60 tests → estimé 2-3k lignes TS
- **UI package** : ~20 pages, ~15 composants, ~5 hooks → estimé 3-4k lignes TSX
- **Total** : ~5-7k lignes, 2-3 semaines de dev à temps plein d'après la volumétrie

Pour agent-brain, avec un schéma plus simple (1 table au lieu de 8) et un UI plus sobre (pas de graph sigma au MVP ?), on est probablement sur **~60-70% du volume Barda**, soit ~3-5k lignes.

---

## 12. Verdict "on prend / on laisse"

### ✅ On prend tel quel
- Monorepo pnpm `@agent-brain/mcp` + `@agent-brain/ui`
- Pattern stdio + HTTP dans le même process avec flag `--ui`
- SQLite + Drizzle + FTS5 avec triggers (mais schéma plat)
- `@huggingface/transformers` + E5-base + content_hash
- MCP SDK + Zod schemas
- Express 5 + JSON-RPC maison (70 lignes)
- Backup/restore avec WAL checkpoint
- Design system oklch Cruchot
- TanStack Query + mcp-client wrapper
- `pnpm workspaces` + `tsup` + `vite`

### 🤔 On adapte
- Schéma DB : 1 table `notes` + 1 table `embeddings` (au lieu de 8)
- FTS5 triggers : 3 triggers (au lieu de 21)
- UI : remplacer `EntityForm` par éditeur Markdown
- Tools : ~12 au lieu de 47
- Ajout watcher `chokidar` + module d'ingestion `.md` → DB

### ❌ On laisse
- Tables écrivain (characters, locations, events...)
- Templates de genres narratifs
- Timeline narrative
- Sigma graph (au MVP : nice to have mais pas critique)
- `extractArray()` et les incohérences de format (on normalise dès le début)

---

## 13. Pour le brainstorm à venir

Les 8 questions déjà listées dans `project_agent_brain_vision.md` restent valides. Ce doc y ajoute 3 questions issues de l'analyse Barda :

9. **Stratégie `vault/` : dossier commité dans `agent-brain` ou repo git privé séparé ?** Barda a tout dans un repo, mais agent-brain va mélanger notes perso et notes projet — question de sensibilité.

10. **Le `_index.md` Obsidian (avec wikilinks, tags, dataview) est-il source of truth ou artefact ?** Si source of truth, le watcher doit le parser. Si artefact, le MCP le (re)génère.

11. **Est-ce qu'on veut le graphe Sigma au MVP ?** Barda l'a mais c'est 300KB gzip + worker ForceAtlas2 + ~500 lignes de code. Pour agent-brain MVP, une simple liste chronologique + search + détail note suffit probablement. Upgrade plus tard.

---

## 14. Prochaine étape suggérée

1. **Lire ce doc à froid** et noter les objections / blocages
2. **Lancer `superpowers:brainstorming`** en session dédiée avec ce doc + `project_agent_brain_vision.md` comme contexte
3. Sortir un `specs/agent-brain-mvp.md` avec schéma DB, liste des tools, arborescence
4. Forker la structure `packages/` de Barda en template et commencer le code

Pas de code avant brainstorm. Pas de brainstorm sans ce doc lu.
