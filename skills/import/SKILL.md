---
name: import
description: "Migration one-shot du contenu .memory/ et _internal/ d'un repo vers gerber."
user-invocable: true
context: fork
---

# import

Migration one-shot du contenu `.memory/`, `_internal/`, `audit/` d'un repo vers agent-brain via MCP.

## Usage

```
/gerber:import [path]
```

- `path` optionnel : chemin custom à scanner. Par défaut : `.memory/`, `_internal/`, `audit/` dans le répertoire courant.

---

## Workflow

### 1. Résoudre le projet

Déterminer le `projectSlug` depuis le CLAUDE.md (section `## Gerber`), `.gerber-slug`, ou `basename` du cwd.

---

### 2. Scan sources

Scanner tous les `.md` dans les dossiers cibles (ou le `path` custom).

Détecter le type de chaque fichier selon ce tableau :

| Pattern | Kind | Tags |
|---|---|---|
| `gotchas.md` ou contient "Problème/Cause/Fix" | atom (1 par gotcha) | `#gotcha` + tags déduits |
| `patterns.md` ou contient "Convention/Pattern" | atom (1 par pattern) | `#pattern` + tags déduits |
| `architecture.md`, `key-files.md` | document | `#architecture` ou `#reference` |
| `_internal/specs/*.md` | document | `#spec #archived` |
| `_internal/plans/*.md` | document | `#plan #archived` |
| `_internal/brainstorms/*.md` | document | `#brainstorm #archived` |
| `audit/*.md` | document | `#audit #archived` |
| Autre `.md` | document | tags déduits |

---

### 3. Split multi-entity files

Les fichiers `gotchas.md` et `patterns.md` contiennent plusieurs items séparés par des headers H2/H3 (`##` ou `###`).

Splitter chaque section en atoms individuels. Le titre de l'atom = le texte du header.

---

### 4. Preview

Afficher un tableau récapitulatif :

| Source | Kind | Title | Tags |
|---|---|---|---|
| ... | ... | ... | ... |

Afficher les totaux : X documents, Y atoms, Z fichiers sources.

Demander confirmation avant de procéder : `Importer ces N notes ? [o/N]`

---

### 5. Import

Pour chaque note, appeler `mcp__gerber__note_create` avec :
- `title` : le titre
- `kind` : `"atom"` ou `"document"`
- `content` : le contenu markdown
- `tags` : les tags
- `source` : `"import"`
- `projectSlug` : le slug résolu

Séquentiel (pas de parallélisme pour éviter les conflits SQLite).

Afficher la progression : `[{i}/{total}] OK {title}` ou `[{i}/{total}] ERR {title} — {error}`

---

### 6. Output

Afficher un résumé final :

```
Import terminé :
  {n} notes créées
  {n} documents
  {n} atoms
  {n} erreurs/doublons sautés
```

---

## Contraintes absolues

- Ne JAMAIS supprimer les fichiers sources
- Ne JAMAIS modifier les notes existantes
- Ne JAMAIS toucher au CLAUDE.md
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
