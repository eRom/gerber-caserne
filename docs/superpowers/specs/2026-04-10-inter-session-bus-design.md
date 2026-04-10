# Inter-Session Bus — Design Spec

> Date : 2026-04-10
> Auteur : Romain + Trinity (session Cruchot S74)
> Status : validé, prêt pour implémentation
> Dépendance : agent-brain MCP backend (Plan A — complété)

## 1. Problème

Les sessions Claude Code sont des processus isolés. Pas de `SendMessage` cross-session. En solo dev multi-pane (Cruchot + agent-brain + autres projets), les sessions ne peuvent pas communiquer : bug reports, contexte partagé, délégation de tâches passent par copier-coller manuel.

**Cas réel qui a motivé cette spec (S74, 2026-04-10) :**
Session Cruchot teste le MCP agent-brain, trouve 3 bugs (fulltext 0 hits, chunker crash sur `table` GFM, FTS5 syntax error sur `.`). Chaque bug doit être copié-collé manuellement dans la session agent-brain. Romain sert de relay humain.

## 2. Solution

Un nouveau kind `message` dans agent-brain qui sert de bus de communication asynchrone entre sessions Claude Code. Routing par projet (basé sur le `cwd` de la session). Découverte par polling (hooks Claude Code), pas de push.

## 3. Schema

### 3.1 Nouveau kind : `message`

```typescript
// Dans @agent-brain/shared/src/db/schema.ts
// Ajouter à côté des tables notes/chunks/embeddings existantes

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type', { enum: ['issue', 'context', 'task'] }).notNull(),
  status: text('status', { enum: ['pending', 'ack', 'done', 'dismissed'] }).notNull().default('pending'),
  priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
  title: text('title').notNull(),
  content: text('content').notNull(), // markdown
  metadata: text('metadata', { mode: 'json' }).$type<MessageMetadata>().default({}),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
})
```

### 3.2 Type metadata

```typescript
interface MessageMetadata {
  // Issue
  severity?: 'bug' | 'regression' | 'warning'
  // Task
  assignee?: string           // slug du projet cible, ou "any"
  // Commun
  source?: string             // identifiant libre de l'émetteur (ex: "session-cruchot-s74")
  sourceProject?: string      // slug du projet émetteur
  relatedNoteIds?: string[]   // UUIDs de notes agent-brain liées (optionnel)
}
```

### 3.3 Index

```sql
CREATE INDEX idx_messages_project_status ON messages(project_id, status);
CREATE INDEX idx_messages_type_status ON messages(type, status);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

## 4. Tools MCP

### 4.1 `message_create`

Crée un message inter-session.

**Input :**
```typescript
{
  projectSlug: string      // slug du projet DESTINATAIRE (résolu en projectId)
  type: 'issue' | 'context' | 'task'
  title: string
  content: string          // markdown, repro steps, contexte, etc.
  priority?: 'low' | 'normal' | 'high'  // default: 'normal'
  metadata?: MessageMetadata
}
```

**Output :**
```typescript
{ ok: true, id: string, item: Message }
```

**Comportement :**
- Résout `projectSlug` → `projectId` via lookup. Si le projet n'existe pas, retourne une erreur (pas de création auto).
- `status` initial = `pending`.
- `metadata.sourceProject` est auto-set si non fourni (basé sur le contexte de la requête, si disponible).

### 4.2 `message_list`

Liste les messages avec filtres.

**Input :**
```typescript
{
  projectSlug?: string              // filtre par projet destinataire
  type?: 'issue' | 'context' | 'task'
  status?: 'pending' | 'ack' | 'done' | 'dismissed'
  since?: number                    // timestamp, messages créés après cette date
  limit?: number                    // default: 50
}
```

**Output :**
```typescript
{
  items: Message[]
  total: number
  pendingCount: number              // raccourci pour le hook startup
}
```

**Comportement :**
- Sans filtre : retourne tous les messages, triés par `createdAt` DESC.
- `pendingCount` est toujours retourné (count global pending pour le projet, indépendant des filtres).

### 4.3 `message_update`

Met à jour le status ou le contenu d'un message.

**Input :**
```typescript
{
  id: string
  status?: 'pending' | 'ack' | 'done' | 'dismissed'
  content?: string                  // append ou replace
  metadata?: Partial<MessageMetadata>  // merge
}
```

**Output :**
```typescript
{ ok: true, item: Message }
```

**Comportement :**
- `updatedAt` auto-set à `Date.now()`.
- `metadata` est merged (pas replaced) : les clés existantes non fournies sont préservées.

## 5. Intégration Claude Code — Hooks

### 5.1 Startup hook (SessionStart)

Le hook startup existant de Cruchot (et de tout projet connecté à agent-brain) est enrichi pour interroger le bus.

```bash
#!/bin/bash
# Ajout au startup hook existant

AGENT_BRAIN="http://127.0.0.1:4000/mcp"
PROJECT_SLUG=$(basename "$PWD")  # Convention : slug = nom du dossier

# Check si agent-brain tourne
if /usr/bin/curl -s --connect-timeout 1 "$AGENT_BRAIN/health" > /dev/null 2>&1; then
  RESULT=$(/usr/bin/curl -s -X POST "$AGENT_BRAIN/mcp" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"message_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"pending\"}}")

  PENDING=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin).get('result',{}); print(r.get('pendingCount',0))" 2>/dev/null)

  if [ "$PENDING" -gt 0 ] 2>/dev/null; then
    DETAILS=$(echo "$RESULT" | python3 -c "
import sys,json
items = json.load(sys.stdin)['result']['items']
for m in items:
    icon = {'issue':'!','context':'i','task':'>'}.get(m['type'],'?')
    prio = ' [HIGH]' if m['priority']=='high' else ''
    print(f'  [{icon}]{prio} {m[\"title\"]}')
" 2>/dev/null)
    echo "agent-brain: $PENDING message(s) en attente"
    echo "$DETAILS"
  fi
fi
```

**Output attendu au démarrage :**
```
agent-brain: 2 message(s) en attente
  [!] [HIGH] FTS5 fulltext retourne 0 résultats
  [>] Tester endpoint search avec dots dans la query
```

### 5.2 UserPromptSubmit hook (poll léger)

Check périodique optionnel. Deux stratégies possibles (au choix de l'utilisateur) :

**Option simple — timestamp last check :**
```bash
# Dans le UserPromptSubmit hook existant
LAST_CHECK_FILE="/tmp/agent-brain-last-check-$$"
NOW=$(date +%s)

if [ -f "$LAST_CHECK_FILE" ]; then
  LAST=$(cat "$LAST_CHECK_FILE")
  ELAPSED=$((NOW - LAST))
  # Check toutes les 5 minutes max
  if [ "$ELAPSED" -lt 300 ]; then
    exit 0
  fi
fi

echo "$NOW" > "$LAST_CHECK_FILE"
# ... même curl que startup, avec since=$LAST pour ne voir que les nouveaux
```

**Pas dans la V1.** Le startup hook suffit pour commencer. Le poll périodique est un nice-to-have quand les sessions durent longtemps.

## 6. UI agent-brain

### 6.1 Vue Messages

Un nouvel onglet/section dans l'UI web `http://localhost:5173`.

**Liste :**
- Filtres : type (issue/context/task), status (pending/ack/done/dismissed), projet
- Tri par date de création DESC
- Badge count pending sur le tab
- Icônes par type : `!` issue, `i` context, `>` task
- Couleur par priorité : high = rouge, normal = défaut, low = gris

**Détail :**
- Title + content markdown rendu
- Metadata affiché (severity, source, sourceProject)
- Boutons d'action : Ack / Done / Dismiss
- Timestamps created/updated

### 6.2 Composants

```
MessagesView
├── MessagesFilter (type, status, project dropdowns)
├── MessagesList
│   └── MessageCard (icône, titre, badge priorité, timestamp relatif)
└── MessageDetail (markdown, metadata, action buttons)
```

## 7. Exemples d'usage

### 7.1 Bug relay (issue)

Session Cruchot trouve un bug dans agent-brain :
```json
{
  "method": "message_create",
  "params": {
    "projectSlug": "agent-brain",
    "type": "issue",
    "title": "FTS5 fulltext retourne 0 résultats",
    "content": "## Repro\n1. note_create document avec contenu 'Vitest'\n2. search(query='Vitest', mode='fulltext') → 0 hits\n3. search(query='Vitest', mode='semantic') → 7 hits\n\n## Hypothèse\nLes triggers FTS5 fts_source ne se déclenchent pas via HTTP /mcp.",
    "priority": "high",
    "metadata": {
      "severity": "bug",
      "sourceProject": "cruchot"
    }
  }
}
```

### 7.2 Context sharing (context)

Session agent-brain informe que le schema a changé :
```json
{
  "method": "message_create",
  "params": {
    "projectSlug": "cruchot",
    "type": "context",
    "title": "agent-brain: nouveau kind 'message' ajouté au schema",
    "content": "Table `messages` ajoutée avec 3 tools MCP : message_create, message_list, message_update. Le search ne couvre PAS les messages (seulement notes/chunks).",
    "metadata": {
      "sourceProject": "agent-brain"
    }
  }
}
```

### 7.3 Task delegation (task)

Session Cruchot demande un test :
```json
{
  "method": "message_create",
  "params": {
    "projectSlug": "agent-brain",
    "type": "task",
    "title": "Tester search fulltext avec caractères spéciaux",
    "content": "Vérifier que ces queries ne crashent plus :\n- `JSON.stringify`\n- `file.read()`\n- `user@email.com`\n- `C++ templates`",
    "priority": "normal",
    "metadata": {
      "sourceProject": "cruchot"
    }
  }
}
```

## 8. Ce qu'on NE fait PAS (YAGNI)

- **Pas de notifications push/SSE** — le poll startup suffit en solo dev
- **Pas de threading/réponses** — un message est standalone, si besoin on crée un nouveau message
- **Pas d'assignation à une session spécifique** — on route par projet, pas par session (les sessions sont éphémères)
- **Pas de TTL/expiration automatique** — dismiss manuel
- **Pas de priorité automatique** — l'émetteur choisit
- **Pas de search sémantique sur les messages** — pas de chunking/embedding, c'est du messaging pas de la knowledge base
- **Pas de chiffrement** — tout est local, même machine
- **Pas de file d'attente ordonnée** — c'est un bus simple, pas un job queue

## 9. Implémentation — Découpage

### Plan A (backend MCP) — à exécuter sur la session agent-brain

1. Migration Drizzle : table `messages` + index
2. Queries CRUD : `createMessage`, `listMessages`, `updateMessage`, `countPending`
3. Tool `message_create` : validation Zod, résolution projectSlug→projectId
4. Tool `message_list` : filtres, pagination, `pendingCount` shortcut
5. Tool `message_update` : status transition, metadata merge
6. Tests : 1 suite couvrant les 3 tools + edge cases (projet inexistant, status invalide)
7. Route HTTP `/mcp` : les 3 tools auto-disponibles via le registry existant

### Plan B (hooks Claude Code) — à exécuter côté projets consommateurs

1. Enrichir le startup hook avec le poll agent-brain
2. Créer une skill `/inbox` pour consulter/ack les messages inline
3. Documenter le setup (comment connecter un nouveau projet)

### Plan C (UI) — à exécuter sur la session agent-brain

1. `MessagesView` composant avec filtres
2. `MessageCard` + `MessageDetail`
3. Route/onglet dans le layout existant
4. Actions ack/done/dismiss via API

### Ordre d'exécution

**Plan A d'abord** (les tools MCP sont le socle), puis **Plan B** (hooks = le client principal), puis **Plan C** (UI = bonus visuel). Plan A et C sur la session agent-brain, Plan B sur les sessions consommateurs (Cruchot, etc.).

## 10. Validation

La feature est considérée complète quand :

1. Session Cruchot peut créer une issue ciblant projet "agent-brain" via `curl POST /mcp`
2. Session agent-brain voit l'issue au démarrage (startup hook)
3. Session agent-brain peut ack/done l'issue
4. Session Cruchot voit le status mis à jour au prochain poll
5. L'UI web affiche les messages avec filtres et actions
