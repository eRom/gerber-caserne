# Skills, Hooks & Inter-Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the 8 Claude Code skills and startup hook that integrate with the agent-brain MCP backend, enabling cross-session communication and knowledge management.

**Architecture:** Skills are `.md` instruction files in `~/.claude/skills/<name>/skill.md`. Each skill describes a workflow that Claude Code follows when invoked. All MCP calls go through `/usr/bin/curl` (RTK bypass) to `http://127.0.0.1:4000/mcp` using JSON-RPC 2.0. Python is used for JSON escaping when sending markdown content.

**Tech Stack:** Markdown skill files, bash hooks, `/usr/bin/curl` for MCP calls, Python3 for JSON escaping

**Specs:**
- `docs/superpowers/specs/2026-04-09-agent-brain-skills.md` — 6 core skills
- `docs/superpowers/specs/2026-04-10-skills-hooks-e2e-design.md` — E2E spec with inbox/send + hooks
- `docs/superpowers/specs/2026-04-10-inter-session-bus-design.md` — message tools (already implemented)

---

## File Structure

All files are outside the repo — they live in `~/.claude/`:

| File | Action | Responsibility |
|------|--------|----------------|
| `~/.claude/skills/agent-brain-onboarding/skill.md` | Create | Init project + CLAUDE.md setup |
| `~/.claude/skills/agent-brain-recall/skill.md` | Create | Search brain for context |
| `~/.claude/skills/agent-brain-capture/skill.md` | Create | Quick atom capture mid-session |
| `~/.claude/skills/agent-brain-archive/skill.md` | Create | Session-end knowledge extraction |
| `~/.claude/skills/agent-brain-review/skill.md` | Create | Weekly maintenance + cleanup |
| `~/.claude/skills/agent-brain-import/skill.md` | Create | One-shot .memory/ migration |
| `~/.claude/skills/inbox/skill.md` | Create | Read inter-session messages |
| `~/.claude/skills/send/skill.md` | Create | Send inter-session messages |
| `~/.claude/commands/session-end.md` | Modify | Add agent-brain archive step |
| `~/.claude/settings.json` | Modify | Add agent-brain poll to SessionStart hook |

---

## Shared Patterns (reference for all skills)

Every skill reuses these patterns. They are documented here once and referenced in each task.

### Health Check Pattern

```bash
AGENT_BRAIN="http://127.0.0.1:4000/mcp"

# Health check — silent fail if MCP is down
HEALTH=$(/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health 2>/dev/null)
if ! echo "$HEALTH" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "agent-brain MCP indisponible sur localhost:4000. Démarre-le avec :"
  echo "  pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db"
  # STOP — do not proceed
fi
```

### MCP Call Pattern (simple params, no markdown)

```bash
call_mcp() {
  local method="$1" params="$2"
  /usr/bin/curl -s -X POST "$AGENT_BRAIN" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}"
}
```

### MCP Call Pattern (markdown content — use Python)

```bash
python3 << 'PYEOF'
import json, subprocess
payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"note_create","params":{
    "title": title, "kind": "atom", "content": content,
    "tags": tags, "source": "ai", "projectId": project_id
}})
subprocess.run(["/usr/bin/curl", "-s", "-X", "POST", AGENT_BRAIN,
    "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True)
PYEOF
```

### Project Resolution Pattern

```
1. Read CLAUDE.md of current repo → find section `## agent-brain` → extract slug
2. Fallback: basename of $PWD → lookup via project_list
3. If no match → error "Exécute /agent-brain-onboarding d'abord."
```

---

## Phase 1 — Fondations

### Task 1: Create `/agent-brain-onboarding` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-onboarding/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §1

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-onboarding
description: "Initialise un projet dans agent-brain et configure le CLAUDE.md du repo courant. Triggers: /agent-brain-onboarding [slug]"
user-invocable: true
---

# /agent-brain-onboarding

## Role

Tu es un assistant d'onboarding agent-brain. Tu initialises un projet dans le MCP agent-brain et configures le CLAUDE.md du repo courant.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000` (démarré via `pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db`)
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire — ne JAMAIS utiliser `curl` nu)

## Invocation

```
/agent-brain-onboarding [slug]
```

- `slug` (optionnel) : si absent, utiliser `basename "$PWD"` en kebab-case.

## Workflow

### 1. Check prérequis

Vérifie que le serveur MCP agent-brain répond. Appelle `/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health`. Si pas de réponse JSON valide → affiche les instructions de démarrage et STOP.

### 2. Vérifier si le projet existe déjà

Appelle le MCP via JSON-RPC :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"project_list","params":{}}'
```

Cherche le slug dans la réponse. Si le projet existe → passe à l'étape 4 (mise à jour CLAUDE.md).

### 3. Créer le projet

Demande confirmation : "Créer le projet `{slug}` dans agent-brain ?"

Si oui, appelle :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"project_create","params":{"slug":"<SLUG>","name":"<NOM_LISIBLE>","repoPath":"<CWD>"}}'
```

### 4. Configurer CLAUDE.md

Lis le `CLAUDE.md` du repo courant. Si la section `## agent-brain` est absente, ajoute-la à la fin :

```markdown
## agent-brain

Ce projet est indexé dans agent-brain sous le slug `{slug}`.

Skills disponibles :
- `/agent-brain-recall` — recherche contextuelle dans la mémoire cross-projets
- `/agent-brain-capture` — capture rapide d'un atome de connaissance
- `/agent-brain-archive` — extraction et archivage fin de session
- `/agent-brain-review` — maintenance hebdomadaire
- `/agent-brain-import` — migration one-shot depuis .memory/
- `/inbox` — consulter les messages inter-sessions
- `/send` — envoyer un message inter-session
```

### 5. Output

```
✓ Projet "{name}" ({slug}) initialisé dans agent-brain.
✓ CLAUDE.md mis à jour avec la section agent-brain.

Prochaine étape : /agent-brain-import pour migrer le contenu existant.
```

## Ce que tu NE fais PAS

- Ne crée aucune note.
- Ne modifie aucun fichier autre que `CLAUDE.md`.
- Ne migre pas le contenu existant.
```

- [ ] **Step 2: Verify the skill is listed**

Run: `/agent-brain-onboarding` in a Claude Code session in any repo.
Expected: The skill appears in the skill list and the workflow starts.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude && git add skills/agent-brain-onboarding/skill.md && git commit -m "feat: add agent-brain-onboarding skill"
```

Note: `~/.claude` may not be a git repo — in that case, skip the commit step for all skill tasks. The files are created directly.

---

### Task 2: Enrich SessionStart hook with agent-brain poll

**Files:**
- Modify: `~/.claude/settings.json`

**Spec ref:** E2E spec §2.1

- [ ] **Step 1: Create the poll script**

Create `~/.claude/hooks/agent-brain-poll.sh`:

```bash
#!/bin/bash
# agent-brain inbox check (startup)
AGENT_BRAIN="http://127.0.0.1:4000/mcp"
PROJECT_SLUG=$(basename "$PWD")

# Check si agent-brain tourne (timeout 1s, silencieux si down)
if ! /usr/bin/curl -s --connect-timeout 1 "http://127.0.0.1:4000/health" > /dev/null 2>&1; then
  exit 0
fi

# Poll messages pending pour le projet courant
RESULT=$(/usr/bin/curl -s -X POST "$AGENT_BRAIN" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"message_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"pending\"}}" 2>/dev/null)

PENDING=$(echo "$RESULT" | python3 -c "
import sys,json
try:
    r = json.load(sys.stdin).get('result',{})
    count = r.get('pendingCount', 0)
    if count > 0:
        print(f'agent-brain: {count} message(s) en attente')
        for m in r.get('items', []):
            icon = {'issue':'!','context':'i','task':'>'}.get(m['type'],'?')
            prio = ' [HIGH]' if m['priority']=='high' else ''
            src = m.get('metadata',{}).get('sourceProject','')
            src_str = f' (from {src})' if src else ''
            print(f'  [{icon}]{prio} {m[\"title\"]}{src_str}')
        print('Tape /inbox pour gerer les messages.')
except:
    pass
" 2>/dev/null)

if [ -n "$PENDING" ]; then
  echo "$PENDING"
fi
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x ~/.claude/hooks/agent-brain-poll.sh
```

- [ ] **Step 3: Add the hook to settings.json**

In `~/.claude/settings.json`, add a new entry to the `hooks.SessionStart` array (after the existing `.memory/*.md` reader):

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "/bin/bash /Users/recarnot/.claude/hooks/agent-brain-poll.sh"
    }
  ]
}
```

The `SessionStart` array becomes:

```json
"SessionStart": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "cat $CLAUDE_PROJECT_DIR/.memory/*.md 2>/dev/null || echo 'No memory files found'"
      }
    ]
  },
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "/bin/bash /Users/recarnot/.claude/hooks/agent-brain-poll.sh"
      }
    ]
  }
]
```

- [ ] **Step 4: Test the hook**

Start a new Claude Code session in a directory matching a known project slug.
Expected: If agent-brain is running and has pending messages, they appear at startup. If agent-brain is down, no output (silent fail).

---

## Phase 2 — Capture & Recherche

### Task 3: Create `/agent-brain-recall` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-recall/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §2

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-recall
description: "Recherche dans agent-brain du contexte pertinent pour la question ou tâche en cours. Triggers: /agent-brain-recall <query>"
user-invocable: true
---

# /agent-brain-recall

## Role

Tu es un assistant de recherche agent-brain. Tu cherches dans la base de connaissances du contexte pertinent pour la question de l'utilisateur.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/agent-brain-recall <query>
```

- `query` : la question ou le sujet à rechercher. Si absent, demande "Que cherches-tu ?".

## Workflow

### 1. Résoudre le projet courant

Lis le `CLAUDE.md` du repo courant → section `## agent-brain` → extrais le slug.
Fallback : `basename "$PWD"` → lookup via `project_list`.
Si aucun match → erreur "Exécute `/agent-brain-onboarding` d'abord."

### 2. Health check

```bash
/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health
```

Si pas de réponse → affiche instructions de démarrage et STOP.

### 3. Recherche hybrid dans le projet courant

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"search","params":{"query":"<QUERY>","mode":"hybrid","projectSlug":"<SLUG>","limit":8}}'
```

### 4. Recherche globale cross-projets

Même appel sans le filtre `projectSlug`, `limit: 5`.

### 5. Fusionner et dédupliquer

Merge les résultats, déduplique par `ownerId`, trie par score décroissant, garde top 10.

### 6. Hydratation

Pour chaque hit :
- **atom** : affiche titre + snippet + tags
- **chunk** : affiche `parent.title` > `chunk.headingPath` + snippet
- Si score > 0.85 : appelle `note_get(id)` pour le contenu complet

### 7. Output structuré

```markdown
## Résultats agent-brain pour "{query}"

### Notes du projet ({slug})
1. **[atom] Titre** (score: 0.91) #tag1 #tag2
   > Snippet du contenu...

2. **[doc] Parent > Section** (score: 0.87) #tag
   > Snippet chunk...

### Notes globales
3. **[atom] Titre** (score: 0.72) #tag
   > ...

---
*{N} résultats trouvés. Utilise `/agent-brain-capture` pour sauvegarder un nouvel apprentissage.*
```

## Ce que tu NE fais PAS

- Ne crée ni modifie aucune note.
- N'injecte pas automatiquement les résultats dans le prompt principal.
```

- [ ] **Step 2: Commit**

---

### Task 4: Create `/agent-brain-capture` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-capture/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §3

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-capture
description: "Capture rapide d'un atome de connaissance (gotcha, pattern, décision) pendant une session. Triggers: /agent-brain-capture [description]"
user-invocable: true
---

# /agent-brain-capture

## Role

Tu es un assistant de capture agent-brain. Tu crées rapidement un atome de connaissance dans la base.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/agent-brain-capture [description libre]
```

- `description libre` (optionnel) : si fourni, utilise comme base. Sinon, analyse les 10 derniers messages de la conversation.

## Workflow

### 1. Résoudre le projet + health check

Même pattern que `/agent-brain-recall` : CLAUDE.md → slug → health check.

### 2. Extraire le contenu

- Si `description libre` fourni → utilise comme base.
- Sinon → analyse les 10 derniers messages, identifie le fait/gotcha/pattern/décision le plus saillant, propose un draft.

### 3. Structurer la note

Génère : `title` (1 ligne, max 200 chars), `content` (markdown, 5-50 lignes), `tags[]` (auto-suggérés).

Format content selon le type détecté :

**Gotcha :**
```markdown
**Problème** : ...
**Cause** : ...
**Fix** : ...
**Fichier(s)** : ...
```

**Pattern :**
```markdown
**Contexte** : ...
**Pattern** : ...
**Exemple** : ...
```

**Décision :**
```markdown
**Décision** : ...
**Alternatives considérées** : ...
**Raison** : ...
```

### 4. Déduplication

Recherche sémantique avec le titre :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"search","params":{"query":"<TITLE>","mode":"semantic","projectSlug":"<SLUG>","limit":3}}'
```

Si un hit a score > 0.92 → affiche "Note similaire existante :" + le hit, demande "Créer quand même ? (o/n)".

### 5. Confirmation + Création

Affiche le draft complet. Demande confirmation.

Pour la création, utilise **Python** pour l'escaping JSON propre du contenu markdown :

```bash
python3 << 'PYEOF'
import json, subprocess
payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"note_create","params":{
    "title": "<TITLE>",
    "kind": "atom",
    "content": "<CONTENT>",
    "tags": ["<TAG1>", "<TAG2>"],
    "source": "ai",
    "projectSlug": "<SLUG>"
}})
subprocess.run(["/usr/bin/curl", "-s", "-X", "POST", "http://127.0.0.1:4000/mcp",
    "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True)
PYEOF
```

### 6. Output

```
✓ Note capturée : "{title}"
  Tags : #gotcha #express #routing
  ID : abc123-...
```

## Ce que tu NE fais PAS

- Ne crée jamais de `kind: 'document'` (c'est le job d'archive ou import).
- Ne modifie pas de note existante.
- Ne capture pas automatiquement sans confirmation.
```

- [ ] **Step 2: Commit**

---

### Task 5: Create `/inbox` skill

**Files:**
- Create: `~/.claude/skills/inbox/skill.md`

**Spec ref:** E2E spec §1.4

- [ ] **Step 1: Create the skill file**

```markdown
---
name: inbox
description: "Consulte les messages inter-sessions (issues, context, tasks) en attente pour le projet courant via agent-brain MCP. Triggers: /inbox, /inbox all, /inbox done"
user-invocable: true
---

# /inbox

## Role

Tu es un assistant de messagerie agent-brain. Tu affiches les messages inter-sessions en attente et permets de les gérer.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/inbox           — messages pending du projet courant
/inbox all       — tous les status du projet courant
/inbox done      — messages done du projet courant
/inbox --project <slug>  — messages d'un autre projet
```

## Workflow

### 1. Résoudre le projet courant

Lis le `CLAUDE.md` du repo courant → section `## agent-brain` → extrais le slug.
Fallback : `basename "$PWD"`.
Si argument `--project <slug>` fourni, utilise ce slug à la place.

### 2. Health check

```bash
/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health
```

Si pas de réponse → affiche instructions de démarrage et STOP.

### 3. Lister les messages

Détermine le status à filtrer selon l'argument :
- `/inbox` ou pas d'argument → `status: "pending"`
- `/inbox all` → pas de filtre status
- `/inbox done` → `status: "done"`

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message_list","params":{"projectSlug":"<SLUG>","status":"<STATUS>"}}'
```

### 4. Afficher les messages formatés

```
=== Inbox — {slug} ({count} {status}) ===

[!] [HIGH] FTS5 fulltext retourne 0 résultats
    from: cruchot | 2h ago

[i] agent-brain: .memory/ ingéré dans le MCP
    from: cruchot | 3h ago

[>] Configurer agent-brain MCP dans les settings
    from: cruchot | 3h ago
```

Icônes : `[!]` = issue, `[i]` = context, `[>]` = task.

### 5. Proposer des actions

Demande : "Action sur un message ? (numéro + ack/done/dismiss, ou 'q' pour quitter)"

Si l'utilisateur choisit une action :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message_update","params":{"id":"<MSG_ID>","status":"<NEW_STATUS>"}}'
```

Confirme : `✓ Message "{title}" → {status}`

### 6. Si aucun message

```
=== Inbox — {slug} (0 pending) ===
Aucun message en attente.
```

## Ce que tu NE fais PAS

- Ne crée pas de messages (c'est le job de `/send`).
- Ne supprime pas de messages (seulement status transitions).
```

- [ ] **Step 2: Commit**

---

### Task 6: Create `/send` skill

**Files:**
- Create: `~/.claude/skills/send/skill.md`

**Spec ref:** E2E spec §1.4

- [ ] **Step 1: Create the skill file**

```markdown
---
name: send
description: "Envoie un message (issue, context ou task) à un autre projet via le bus inter-sessions agent-brain. Triggers: /send <project> <type> <title>"
user-invocable: true
---

# /send

## Role

Tu es un assistant de messagerie agent-brain. Tu envoies un message inter-session à un projet cible.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/send <projectSlug> <type> "<title>"   — mode direct
/send                                   — mode interactif guidé
```

- `projectSlug` : slug du projet DESTINATAIRE
- `type` : `issue`, `context`, ou `task`
- `title` : titre du message (entre guillemets si espaces)

## Workflow

### 1. Health check

```bash
/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health
```

Si pas de réponse → affiche instructions et STOP.

### 2. Parser les arguments

- Si les 3 arguments sont fournis → mode direct.
- Si arguments manquants → mode interactif :
  1. Demande le projet destinataire (liste les projets disponibles via `project_list`)
  2. Demande le type (issue/context/task)
  3. Demande le titre

### 3. Demander le contenu

Demande le contenu du message en markdown. Pour les issues, suggère le format :

```markdown
## Repro
1. ...
2. ...

## Attendu
...

## Observé
...
```

### 4. Options additionnelles

- Priority : demande si high/normal/low (défaut: normal)
- Pour les issues : demande severity (bug/regression/warning)

### 5. Résoudre le projet source

Le `sourceProject` est déterminé automatiquement depuis le CLAUDE.md ou basename du repo courant.

### 6. Créer le message

Utilise **Python** pour l'escaping JSON :

```bash
python3 << 'PYEOF'
import json, subprocess
payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"message_create","params":{
    "projectSlug": "<TARGET_SLUG>",
    "type": "<TYPE>",
    "title": "<TITLE>",
    "content": "<CONTENT>",
    "priority": "<PRIORITY>",
    "metadata": {
        "sourceProject": "<SOURCE_SLUG>",
        "severity": "<SEVERITY_IF_ISSUE>"
    }
}})
subprocess.run(["/usr/bin/curl", "-s", "-X", "POST", "http://127.0.0.1:4000/mcp",
    "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True)
PYEOF
```

### 7. Output

```
✓ Message envoyé à {targetProject} : [{type}] {title}
  Priority : {priority}
  ID : abc123-...
```

## Ce que tu NE fais PAS

- Ne lit pas les messages (c'est le job de `/inbox`).
- Ne modifie pas les messages existants.
```

- [ ] **Step 2: Commit**

---

## Phase 3 — Automation

### Task 7: Create `/agent-brain-archive` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-archive/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §4

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-archive
description: "Extraction et archivage des apprentissages de la session courante vers agent-brain. Triggers: /agent-brain-archive"
user-invocable: true
---

# /agent-brain-archive

## Role

Tu es un archiviste agent-brain. Tu extrais les apprentissages de la session en cours et les archives dans la base de connaissances.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/agent-brain-archive
```

Aucun argument. Travaille sur la session en cours.

## Workflow

### 1. Résoudre le projet + health check

Même pattern : CLAUDE.md → slug → health check.

### 2. Analyser la conversation

Scanne tous les messages de la session en cours. Extrais :
- **Gotchas** découverts (bugs, pièges, workarounds)
- **Patterns** établis (conventions, architectures validées)
- **Décisions** prises (choix techniques, trade-offs tranchés)
- **Specs/plans produits** (brainstorms, designs qui méritent archivage en document)

Pour chaque item, génère un draft : `title`, `content` (markdown structuré selon le type — voir formats dans `/agent-brain-capture`), `tags[]`, `kind` (atom pour gotchas/patterns/décisions, document pour specs/plans).

### 3. Déduplication batch

Pour chaque draft, fais une recherche sémantique :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"search","params":{"query":"<DRAFT_TITLE>","mode":"semantic","projectSlug":"<SLUG>","limit":3}}'
```

Catégorise chaque draft :
- Score > 0.92 → **skip** (existant)
- Score 0.75–0.92 → **à confirmer** (possible doublon)
- Score < 0.75 → **nouveau**

### 4. Présentation et confirmation

```markdown
## Archive de session — {N} apprentissages extraits

### Nouveaux (à créer)
1. [atom] **WAL checkpoint avant restore** #gotcha #sqlite
2. [atom] **RRF k=60 pour hybrid search** #pattern #search

### Doublons (skip)
3. [skip] Express 5 wildcard → existant (note abc123)

### À confirmer
4. [?] Drizzle schema dans shared → similaire à "Gotcha 3 camelCase" (score 0.88)

Créer les items 1-2 ? Les "à confirmer" seront demandés un par un. (o/n)
```

### 5. Création batch

Pour chaque note confirmée, utilise **Python** pour l'escaping JSON :

```bash
python3 << 'PYEOF'
import json, subprocess
AGENT_BRAIN = "http://127.0.0.1:4000/mcp"
# ... pour chaque note ...
payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"note_create","params":{
    "title": title, "kind": kind, "content": content,
    "tags": tags, "source": "ai", "projectSlug": slug
}})
subprocess.run(["/usr/bin/curl", "-s", "-X", "POST", AGENT_BRAIN,
    "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True)
PYEOF
```

### 6. Output

```
✓ Session archivée dans agent-brain ({slug}) :
  - 2 atomes créés
  - 1 document créé (12 chunks)
  - 1 doublon ignoré
  - 1 confirmé manuellement
```

## Mode appelé par /session-end

Quand appelé par `/session-end` (détecté par le contexte — pas d'interaction utilisateur en cours) :
- La confirmation est **groupée** (pas item par item).
- Les "à confirmer" (score 0.75–0.92) sont créés en `status: 'draft'` pour review ultérieure via `/agent-brain-review`.
- Si le serveur MCP ne répond pas → log warning et continue (ne bloque pas session-end).

## Ce que tu NE fais PAS

- Ne modifie pas de notes existantes.
- Ne supprime rien.
- Ne touche pas à `.memory/`.
```

- [ ] **Step 2: Commit**

---

### Task 8: Modify `/session-end` to integrate agent-brain archive

**Files:**
- Modify: `~/.claude/commands/session-end.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §7

- [ ] **Step 1: Add step 4 to session-end**

After the existing step 3 ("Met à jour CLAUDE.md avec un pointeur lazy"), add a new section **before** the "### 4. Règles d'écriture" section (which becomes step 5). Insert:

```markdown
### 4. Archive vers agent-brain (conditionnel)

Si le `CLAUDE.md` du projet courant contient une section `## agent-brain` :
- Appelle la skill `/agent-brain-archive` en mode automatique (sans confirmation item par item).
- En mode automatique, la confirmation est groupée : les items "nouveau" sont créés directement, les "à confirmer" (score 0.75–0.92) sont créés en `status: 'draft'`.
- Si le serveur MCP `agent-brain` ne répond pas → log "agent-brain: MCP indisponible, archive skippée" et continue (ne bloque jamais session-end).

Si la section `## agent-brain` est absente → skip silencieux, aucun log.
```

Also update the "### 5. Output" section to include an agent-brain line:

```markdown
- agent-brain : {X} notes archivées, {Y} drafts (si étape 4 exécutée)
```

Renumber existing steps: "4. Règles d'écriture" → "5. Règles d'écriture", "5. Output" → "6. Output".

- [ ] **Step 2: Verify the modification**

Read `~/.claude/commands/session-end.md` and verify steps are numbered 1–6 with the new step 4 properly inserted.

- [ ] **Step 3: Commit**

---

### Task 9: Create `/agent-brain-import` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-import/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §6

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-import
description: "Migration one-shot du contenu .memory/ et _internal/ d'un repo vers agent-brain. Triggers: /agent-brain-import [path]"
user-invocable: true
---

# /agent-brain-import

## Role

Tu es un assistant de migration agent-brain. Tu importes le contenu existant (.memory/, _internal/, audit/) dans la base de connaissances.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/agent-brain-import [path]
```

- `path` (optionnel) : chemin vers le dossier à importer. Défaut : `.memory/` + `_internal/` + `audit/` du repo courant.

## Workflow

### 1. Résoudre le projet + health check

Même pattern : CLAUDE.md → slug → health check.

### 2. Scanner les sources

Liste tous les `.md` dans les dossiers source. Pour chaque fichier, détecte le type :

| Pattern | Kind | Tags auto |
|---|---|---|
| `gotchas.md` ou contient "Problème/Cause/Fix" | atom (1 par gotcha) | `#gotcha` + tags déduits |
| `patterns.md` ou contient "Convention/Pattern" | atom (1 par pattern) | `#pattern` + tags déduits |
| `architecture.md`, `key-files.md` | document | `#architecture` ou `#reference` |
| `_internal/specs/*.md` | document | `#spec` + `#archived` |
| `_internal/plans/*.md` | document | `#plan` + `#archived` |
| `_internal/brainstorms/*.md` | document | `#brainstorm` + `#archived` |
| `audit/*.md` | document | `#audit` + `#archived` |
| Autres `.md` | document | tags déduits du contenu |

### 3. Cas spécial : fichiers multi-entités

`gotchas.md` et `patterns.md` contiennent typiquement **plusieurs** items séparés par des headers H2/H3. Split chaque section en un atom individuel.

Exemple : `gotchas.md` avec 15 sections H2 → 15 atoms `kind='atom'` avec `tags: ['gotcha', ...]`.

### 4. Preview

```markdown
## Import preview — {slug}

Sources scannées :
- .memory/ : 4 fichiers
- _internal/specs/ : 8 fichiers

Plan d'import :
| # | Source | → Kind | Title | Tags |
|---|---|---|---|---|
| 1 | .memory/gotchas.md §1 | atom | Express 5 wildcard | #gotcha #express |
| 2 | .memory/gotchas.md §2 | atom | Sigma.js type réservé | #gotcha #sigma |
| 17 | _internal/specs/test-strategy.md | doc | Test Strategy Design | #spec #archived |

Total : {X} atoms + {Y} documents = {Z} notes à créer.
Continuer ? (o/n)
```

### 5. Import

Création séquentielle via **Python** pour chaque note (escaping JSON propre) :

```bash
python3 << 'PYEOF'
import json, subprocess
AGENT_BRAIN = "http://127.0.0.1:4000/mcp"
# Pour chaque note...
payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"note_create","params":{
    "title": title, "kind": kind, "content": content,
    "tags": tags, "source": "import", "projectSlug": slug,
    "status": status  # 'active' pour atoms, 'archived' pour specs/plans/brainstorms
}})
result = subprocess.run(["/usr/bin/curl", "-s", "-X", "POST", AGENT_BRAIN,
    "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True)
# Parse result, print progress
PYEOF
```

Progress par ligne : `[{i}/{total}] ✓ {title}`

`source: 'import'` systématique. Les specs/plans/brainstorms → `status: 'archived'`.

### 6. Output

```
✓ Import terminé : {X} atoms + {Y} documents créés dans "{slug}".
  Temps : ~{T}s
  Doublons skippés : {N}

Tu peux maintenant supprimer .memory/ et _internal/ si tu le souhaites
(après vérification dans l'UI agent-brain http://localhost:5173).
```

## Ce que tu NE fais PAS

- Ne supprime PAS les fichiers source.
- Ne modifie aucune note existante dans agent-brain.
- Ne touche pas au CLAUDE.md.
```

- [ ] **Step 2: Commit**

---

## Phase 4 — Maintenance

### Task 10: Create `/agent-brain-review` skill

**Files:**
- Create: `~/.claude/skills/agent-brain-review/skill.md`

**Spec ref:** `2026-04-09-agent-brain-skills.md` §5

- [ ] **Step 1: Create the skill file**

```markdown
---
name: agent-brain-review
description: "Maintenance hebdomadaire agent-brain — stats, notes stale, drafts en attente, nettoyage. Triggers: /agent-brain-review [project_slug]"
user-invocable: true
---

# /agent-brain-review

## Role

Tu es un assistant de maintenance agent-brain. Tu fais le ménage dans la base de connaissances.

## Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000`
- `/usr/bin/curl` pour les appels MCP (RTK bypass obligatoire)

## Invocation

```
/agent-brain-review [project_slug]
```

- `project_slug` (optionnel) : si absent, review le projet courant. Si `--all`, review tous les projets.

## Workflow

### 1. Health check + résolution projet

Même pattern que les autres skills.

### 2. Stats globales

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_stats","params":{}}'
```

Affiche :
```
agent-brain : {N} projets • {M} notes ({atoms} atoms, {docs} docs) • {C} chunks • {S} MB
Top tags : #gotcha ({n}) #pattern ({n}) ...
```

### 3. Drafts en attente

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"note_list","params":{"status":"draft","sort":"created_desc","limit":20}}'
```

Si non-vide → affiche la liste, propose pour chacun : "Activer / Archiver / Supprimer ?"

### 4. Notes stale

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"note_list","params":{"status":"active","sort":"updated_desc","limit":50}}'
```

Identifie les notes non-touchées depuis > 30 jours. Propose : "Archiver les {N} notes stale ? (o/n/détail)"

### 5. Doublons potentiels (si corpus > 50 notes)

Pour les 10 notes les plus récentes, fais une recherche sémantique par titre. Si un hit ≠ self a score > 0.90 → signale comme doublon potentiel.

### 6. Actions

Chaque action confirmée → `note_update` :

```bash
/usr/bin/curl -s -X POST "http://127.0.0.1:4000/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"note_update","params":{"id":"<ID>","patch":{"status":"<STATUS>"}}}'
```

Suppressions → `note_delete` après double confirmation.

### 7. Output

```
✓ Review terminée :
  - {N} drafts activés
  - {M} notes archivées (stale > 30j)
  - {K} doublons signalés
  Prochaine review suggérée : semaine prochaine
```

## Ce que tu NE fais PAS

- Ne crée pas de notes.
- Ne modifie pas le contenu des notes (seulement le status).
```

- [ ] **Step 2: Commit**

---

## Validation E2E

After all tasks are complete, validate the following scenarios manually:

### Scenario 1: Onboarding + Import + Recall

```
1. cd ~/dev/some-project
2. /agent-brain-onboarding
3. /agent-brain-import
4. /agent-brain-recall "some query"
```

### Scenario 2: Bug relay cross-session

```
Session A (project-a):
  /send project-b issue "Bug title"

Session B (project-b):
  → startup shows "1 message en attente"
  /inbox → see the issue, ack it
```

### Scenario 3: Session-end archive

```
/session-end
→ Step 4 should trigger agent-brain-archive if ## agent-brain in CLAUDE.md
```
