---
name: gerber-archive
description: "Extraction et archivage des apprentissages de la session courante vers agent-brain. Triggers: /gerber-archive"
user-invocable: true
---

# gerber-archive

Extrait et archive les apprentissages de la session courante vers agent-brain.

## Workflow

### 1. Résoudre le projet

- Lire le `CLAUDE.md` du projet courant pour identifier le slug
- Fallback : lire `.gerber-slug`, puis `basename` du répertoire courant

### 2. Analyser la conversation

Scanner tous les messages de la session courante et extraire :

- **Gotchas** — bugs, pièges, contournements
- **Patterns** — conventions, architectures validées
- **Decisions** — choix techniques, trade-offs
- **Specs/plans produits** — brainstorms, designs → kind `document`

Pour chaque item, générer un draft :
- `title` : titre court et descriptif
- `content` : markdown structuré
- `tags[]` : tags pertinents
- `kind` : `atom` pour gotchas/patterns/decisions, `document` pour specs/plans

### 3. Batch dedup

Pour chaque draft, recherche sémantique par titre via `mcp__gerber__search` :
- `query` : le titre du draft
- `limit` : 3

Règles de dédup :
- Score > 0.92 → **skip** (existant)
- Score 0.75–0.92 → **à confirmer** (doublon possible)
- Score < 0.75 → **nouveau**

### 4. Présenter et confirmer

Afficher la liste catégorisée :

```
## Nouveaux (X)
- [atom] Titre du gotcha — tags: foo, bar
- [document] Titre du spec — tags: baz

## À confirmer — possible doublon (Y)
- [atom] Titre similaire — score 0.81 vs "Note existante"

## Doublons ignorés (Z)
- Titre déjà archivé — score 0.95
```

Demander une confirmation groupée avant de créer.

### 5. Batch create

Pour chaque note confirmée, appeler `mcp__gerber__note_create` avec :
- `title`, `kind`, `content`, `tags`
- `source` : `"ai"`
- `projectSlug` : le slug résolu

Afficher la progression : `[{i}/{total}] OK {title}` ou `[{i}/{total}] ERR {title} — {error}`

### 6. Output final

Résumé avec compteurs :

```
Session archivée :
  X atoms créés
  Y documents créés
  — Z doublons ignorés
```

---

## Mode appelé par /session-end

Quand invoqué par `/session-end` (sans interaction directe avec l'utilisateur) :

- La confirmation est **groupée** (pas item par item)
- Les items avec score 0.75–0.92 sont créés avec `status: 'draft'` pour revue ultérieure via `/gerber-review`
- Si le MCP ne répond pas → logger un warning et continuer (ne jamais bloquer session-end)

---

## Contraintes strictes

- Ne PAS modifier les notes existantes
- Ne PAS supprimer quoi que ce soit
- Ne PAS toucher `.memory/`
- Utiliser exclusivement les outils MCP `mcp__gerber__*` — jamais curl
