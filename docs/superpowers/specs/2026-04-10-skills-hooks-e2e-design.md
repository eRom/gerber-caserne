# Skills, Hooks & Inter-Session — Spec E2E

> Date : 2026-04-10
> Auteur : Trinity (session Cruchot S74) — basé sur tests manuels MCP réels
> Statut : validé, prêt pour implémentation
> Dépendances :
>   - `2026-04-09-agent-brain-skills.md` — 6 skills agent-brain
>   - `2026-04-10-inter-session-bus-design.md` — inter-session bus (implémenté)
>   - MCP backend Plan A (complété, 15 tools dont 3 message_*)

## 0 — Contexte

Le MCP backend est opérationnel : 15 tools (4 projects, 5 notes, 1 search, 2 maintenance, 3 messages), 3 modes de recherche (semantic, fulltext, hybrid), embeddings E5 multilingual 768d. Le bus inter-sessions est implémenté (kind `message`, 3 tools, UI Messages).

Cette spec couvre **l'intégration côté consommateur** : les skills Claude Code, les hooks, et le workflow complet cross-sessions.

### Prérequis runtime

- agent-brain MCP sur `http://127.0.0.1:4000` (démarré via `pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db`)
- RTK intercepte `curl` → toujours utiliser `/usr/bin/curl` pour les appels MCP (RTK transforme les réponses JSON en schéma, cassant le parsing)
- Ollama pour `/ocr` (optionnel, skill séparée déjà implémentée)

---

## 1 — Skills Claude Code (6 + 2)

### 1.1 Les 6 skills agent-brain (spec `2026-04-09`)

Ces skills sont définies dans `2026-04-09-agent-brain-skills.md`. Elles sont à implémenter comme fichiers dans `~/.claude/skills/agent-brain-{name}/skill.md`.

**Point critique d'implémentation** : toutes les skills appellent le MCP via `/usr/bin/curl` (pas `curl` nu — RTK bypass obligatoire). Le pattern commun :

```bash
AGENT_BRAIN="http://127.0.0.1:4000/mcp"

call_mcp() {
  local method="$1" params="$2"
  /usr/bin/curl -s -X POST "$AGENT_BRAIN" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}"
}
```

Pour les skills qui envoient du contenu markdown (capture, archive, import), le payload doit être construit en **Python** pour un escaping JSON propre (pas de heredoc bash — les backticks et `${}` dans le markdown cassent l'escaping shell) :

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

### 1.2 Résolution du projet courant

Toutes les skills (sauf onboarding) déterminent le projet via le `CLAUDE.md` du repo. Mais on a aussi une convention plus simple : le **slug = nom du dossier courant** (validé en S74). Les deux méthodes doivent coexister :

1. Lire `CLAUDE.md` section `## agent-brain` → extraire le slug
2. Fallback : `basename "$PWD"` → lookup via `project_list`
3. Si aucun match → erreur "Exécute `/agent-brain-onboarding` d'abord."

### 1.3 Détection agent-brain disponible

Avant tout appel MCP, chaque skill vérifie que le serveur répond :

```bash
HEALTH=$(/usr/bin/curl -s --connect-timeout 2 http://127.0.0.1:4000/health 2>/dev/null)
if ! echo "$HEALTH" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "agent-brain MCP indisponible sur localhost:4000. Démarre-le avec :"
  echo "  pnpm --filter @agent-brain/mcp dev -- --ui --db-path ~/.agent-brain/brain.db"
  exit 1
fi
```

### 1.4 Les 2 nouvelles skills inter-session

#### `/inbox` — Consulter les messages en session

```yaml
name: inbox
description: "Consulte les messages inter-sessions (issues, context, tasks) en attente pour le projet courant via agent-brain MCP. Triggers: /inbox, /inbox all, /inbox done"
user-invocable: true
```

**Workflow :**

1. Résoudre le projet courant (slug via CLAUDE.md ou basename)
2. `message_list(projectSlug, status)` — défaut `status=pending`
3. Afficher les messages formatés :
   ```
   === Inbox — cruchot (3 pending) ===
   
   [!] [HIGH] FTS5 fulltext retourne 0 résultats
       from: agent-brain | 2h ago
   
   [i] agent-brain: .memory/ ingéré dans le MCP
       from: cruchot | 3h ago
   
   [>] Configurer agent-brain MCP dans les settings
       from: cruchot | 3h ago
   ```
4. Proposer des actions : "Ack/Done/Dismiss un message ? (id ou numéro)"
5. Si action → `message_update(id, status)`

**Arguments :**
- `/inbox` — pending du projet courant
- `/inbox all` — tous les status du projet courant
- `/inbox --project agent-brain` — pending d'un autre projet

#### `/send` — Envoyer un message inter-session

```yaml
name: send
description: "Envoie un message (issue, context ou task) à un autre projet via le bus inter-sessions agent-brain. Triggers: /send <project> <type> <title>"
user-invocable: true
```

**Workflow :**

1. Parser les arguments : `projectSlug`, `type` (issue/context/task), `title`
2. Si arguments manquants, demander interactivement
3. Demander le contenu (markdown, multi-lignes)
4. Optionnel : priority (défaut normal), metadata.severity pour les issues
5. `message_create(projectSlug, type, title, content, priority, metadata)`
6. Confirmer : `✓ Message envoyé à {project} : [{type}] {title}`

**Raccourcis :**
- `/send agent-brain issue "FTS5 crash sur dots"` — mode direct
- `/send` — mode interactif guidé

---

## 2 — Hooks Claude Code

### 2.1 Startup hook — Poll agent-brain

Enrichir le hook `SessionStart` existant pour interroger le bus au démarrage de chaque session.

**Emplacement :** `~/.claude/settings.json` → hook `SessionStart`

**Script :**

```bash
#!/bin/bash
# agent-brain inbox check (startup)
AGENT_BRAIN="http://127.0.0.1:4000/mcp"
PROJECT_SLUG=$(basename "$PWD")

# Check si agent-brain tourne (timeout 1s, silencieux si down)
if ! /usr/bin/curl -s --connect-timeout 1 "$AGENT_BRAIN/../health" > /dev/null 2>&1; then
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

**Comportement :**
- Si agent-brain est down → silencieux (exit 0), ne bloque jamais le startup
- Si le projet n'existe pas dans agent-brain → 0 pending, silencieux
- Si messages pending → affiche le résumé + hint `/inbox`
- Timeout connect 1s → pas de lag perceptible au démarrage

### 2.2 Pas de hook UserPromptSubmit en V1

Comme décidé dans la spec inter-session : le poll périodique est un nice-to-have. Le startup hook + `/inbox` manuel suffisent pour la V1. Les sessions durent rarement plus de 30 minutes, et le startup hook couvre le cas principal (reprendre le travail là où une autre session a laissé des messages).

---

## 3 — Workflow E2E — Scénarios de validation

### 3.1 Scénario : Onboarding + Import + Recall

```
Session A (projet Cruchot) :
  1. /agent-brain-onboarding cruchot
     → Projet créé, CLAUDE.md mis à jour
  2. /agent-brain-import
     → .memory/ ingéré (4 docs + N atoms si split gotchas/patterns)
  3. /agent-brain-recall "seatbelt sandbox electron"
     → Hits pertinents depuis gotchas.md chunks
```

### 3.2 Scénario : Bug relay cross-session (validé S74)

```
Session A (Cruchot) :
  1. Teste search fulltext → 0 résultats (bug)
  2. /send agent-brain issue "FTS5 fulltext 0 hits"
     → message_create(projectSlug="agent-brain", type="issue", ...)
     → Message pending dans agent-brain

Session B (agent-brain) :
  3. Démarre → startup hook affiche "1 message en attente"
  4. /inbox → voit l'issue, ack
  5. Fix le bug
  6. /inbox → done l'issue

Session A (Cruchot) :
  7. /inbox → voit "issue resolved"
```

### 3.3 Scénario : Session-end + Archive

```
Session A (Cruchot, fin de session) :
  1. /session-end
     → Étape 1-3 : met à jour .memory/ (inchangé)
     → Étape 4 : détecte section ## agent-brain dans CLAUDE.md
     → Appelle /agent-brain-archive en mode auto
     → Extrait 3 gotchas + 1 décision de la session
     → Dédup : 1 doublon skippé (score 0.94)
     → Crée 2 atoms + 1 draft (score 0.82, à confirmer)
     → Étape 5 : output final inclut "agent-brain : 2 notes archivées, 1 draft"

Session B (n'importe quel projet, plus tard) :
  2. /agent-brain-review
     → Voit le draft en attente
     → L'utilisateur active ou supprime
```

### 3.4 Scénario : Context sharing multi-projets

```
Session A (agent-brain) :
  1. Ajoute une table "messages" au schema
  2. /send cruchot context "Nouveau kind 'message' dans agent-brain"
     → message_create(projectSlug="cruchot", type="context", ...)

Session B (Cruchot) :
  3. Démarre → "1 context en attente : Nouveau kind 'message' dans agent-brain"
  4. La session sait maintenant que le schema a changé
```

### 3.5 Scénario : Task delegation

```
Session A (Cruchot) :
  1. /send agent-brain task "Ajouter remark-gfm au chunker"
     → priority: high, metadata.severity: "bug"

Session B (agent-brain) :
  2. Démarre → "1 task HIGH en attente"
  3. /inbox → voit la task, ack
  4. Implémente le fix
  5. /inbox → done
```

---

## 4 — Fichiers à créer/modifier

### Skills (8 fichiers)

| Fichier | Source |
|---------|--------|
| `~/.claude/skills/agent-brain-onboarding/skill.md` | Spec skills §1 |
| `~/.claude/skills/agent-brain-recall/skill.md` | Spec skills §2 |
| `~/.claude/skills/agent-brain-capture/skill.md` | Spec skills §3 |
| `~/.claude/skills/agent-brain-archive/skill.md` | Spec skills §4 |
| `~/.claude/skills/agent-brain-review/skill.md` | Spec skills §5 |
| `~/.claude/skills/agent-brain-import/skill.md` | Spec skills §6 |
| `~/.claude/skills/inbox/skill.md` | Cette spec §1.4 |
| `~/.claude/skills/send/skill.md` | Cette spec §1.4 |

### Hooks (1 modification)

| Fichier | Action |
|---------|--------|
| `~/.claude/settings.json` | Enrichir hook `SessionStart` avec le poll agent-brain |

### Modifications existantes (2 fichiers)

| Fichier | Action |
|---------|--------|
| `~/.claude/skills/session-end/skill.md` | Ajouter étape 4 (archive conditionnel) — spec skills §7 |
| CLAUDE.md de chaque projet onboardé | Section `## agent-brain` ajoutée par onboarding |

---

## 5 — Ordre d'implémentation recommandé

```
Phase 1 — Fondations (bloque tout le reste)
  1. agent-brain-onboarding    ← setup projet + CLAUDE.md
  2. Startup hook              ← poll messages au démarrage

Phase 2 — Capture & Recherche (usage quotidien)
  3. agent-brain-recall        ← recherche dans le brain
  4. agent-brain-capture       ← capture mid-session
  5. inbox                     ← consulter messages
  6. send                      ← envoyer messages

Phase 3 — Automation (workflow complet)
  7. agent-brain-archive       ← extraction fin de session
  8. session-end modification  ← intégration archive
  9. agent-brain-import        ← migration one-shot

Phase 4 — Maintenance
  10. agent-brain-review       ← nettoyage hebdomadaire
```

---

## 6 — Gotchas découverts en S74 (à intégrer)

| # | Gotcha | Impact |
|---|--------|--------|
| 1 | **RTK intercepte curl** — les réponses JSON sont transformées en schéma (types au lieu de valeurs). Toujours `/usr/bin/curl` | Toutes les skills |
| 2 | **Chunker crash sur `table` GFM** — remark sans remark-gfm ne parse pas les tableaux markdown. Fix appliqué S74 | `/agent-brain-import` sur patterns.md et key-files.md |
| 3 | **FTS5 syntax error sur `.`** — les points dans la query sont interprétés comme opérateurs FTS5. Fix : sanitisation query. Fix appliqué S74 | `/agent-brain-recall` avec des noms de fonctions (JSON.stringify, etc.) |
| 4 | **FTS5 fulltext 0 hits** — triggers fts_source non peuplés lors des INSERT. Fix : table fts_source + offset 1 milliard chunk rowids. Fix appliqué S74 | Recherche fulltext post-import |
| 5 | **tsx watch hot-reload ne marche pas toujours** — le serveur MCP peut tourner sur du code stale après un fix. Vérifier `/health` → champ `update` | Debug skills si le serveur semble ignorer un fix |
| 6 | **DB smoke-test vs prod** — si une autre session lance des tests, le serveur peut pointer vers `/tmp/brain-smoke.db` au lieu de `~/.agent-brain/brain.db`. Vérifier `dbPath` dans `/health` | Données disparues = probablement mauvaise DB |

---

## 7 — Ce qu'on NE fait PAS (YAGNI)

- **Pas de MCP natif dans les settings Claude Code en V1** — les skills appellent via curl, pas via `mcpServers` config. Le MCP natif viendrait en V2 quand le transport stdio/SSE est stabilisé.
- **Pas de poll UserPromptSubmit** — startup hook + `/inbox` manuel suffisent.
- **Pas de notifications desktop** — les messages ne sont pas urgents au point de justifier une notification macOS.
- **Pas de merge/update de notes existantes** — create ou skip, jamais d'update automatique du contenu (trop risqué).
- **Pas de sync bidirectionnelle .memory/ ↔ agent-brain** — dual-write unidirectionnel : write .md → note_update MCP. Pas l'inverse.
