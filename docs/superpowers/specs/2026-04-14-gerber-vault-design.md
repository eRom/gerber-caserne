# gerber-vault — Vault d'archives cross-projets

> Date : 2026-04-14
> Status : draft

## Problème

Les docs générés pendant le dev (specs, plans, brainstorms) s'accumulent dans le repo actif et polluent le contexte des agents. NotebookLM comme backend de cold storage est fragile (auth, doublons, lenteur, dépendance Google).

## Solution

Un repo git privé unique (`~/.config/gerber-vault/`) servant de vault d'archives. Les docs terminés y sont archivés, indexés, et consultables par grep. Léger, fiable, versionné.

## Architecture

```
~/.config/gerber-vault/              # repo git privé GitHub
  INDEX.md                           # Index global
  agent-brain/
    INDEX.md                         # Index projet
    docs/superpowers/specs/
      2026-04-10-kanban-design.md
    notes-vrac.md
  cruchot/
    INDEX.md
    ipc-design.md
```

### Règles de structure

- Un dossier par projet, nommé par son slug gerber (`.gerber-slug` → CLAUDE.md `## Gerber` → `basename $PWD`)
- La structure interne reproduit la structure source (chemins relatifs préservés)
- Fichiers archivés sans chemin relatif → racine du dossier projet

## Index

### INDEX.md global

```markdown
# Gerber Vault

| Projet | Fichiers | Derniere archive |
|--------|----------|------------------|
| agent-brain | 12 | 2026-04-14 |
| cruchot | 5 | 2026-03-20 |
```

### INDEX.md projet

```markdown
# agent-brain

| Fichier | Description | Date |
|---------|-------------|------|
| docs/superpowers/specs/2026-04-10-kanban-design.md | Design kanban 7 colonnes | 2026-04-14 |
```

- Description : titre H1 du fichier, ou première ligne non-vide, tronquée à 80 chars
- Date : date d'archivage

## Skill `/gerber-vault`

### Sous-commandes

| Commande | Description | Exécution |
|----------|-------------|-----------|
| `archive <fichiers\|dossier>` | Archiver des docs dans le vault | Agent Sonnet, background |
| `search <query>` | Chercher dans le vault par grep | Contexte principal |
| `status` | Stats du vault | Contexte principal |
| `index` | Régénérer les INDEX.md | Agent Sonnet, background |

### Flow `archive`

**Pré-traitement (contexte principal) :**

1. Résoudre le slug projet
2. Résoudre la liste de fichiers :
   - Dossier → listing récursif
   - Fichiers explicites → liste telle quelle
   - Pas de filtrage par extension (on archive ce qu'on nous donne)
3. Vérifier que `~/.config/gerber-vault/` existe et est un repo git
4. Afficher "Archivage lancé en background..."

**Agent Sonnet (background) :**

1. Copier chaque fichier vers `~/.config/gerber-vault/{slug}/` en préservant les chemins relatifs par rapport à la racine du repo source
2. Mettre à jour `{slug}/INDEX.md` :
   - Ajouter les nouvelles entrées (pas de doublons — skip si le chemin existe déjà)
   - Extraire la description depuis le contenu du fichier (H1 ou première ligne)
3. Mettre à jour `INDEX.md` global :
   - Recalculer le nombre de fichiers par projet (compter les entrées dans chaque INDEX.md projet)
   - Mettre à jour la date de dernière archive
4. `git add . && git commit -m "archive({slug}): {nb} fichiers" && git push`
5. Retourner le résumé : fichiers archivés, skippés, total

**Retour au contexte principal :**

- Afficher le résumé de l'agent
- Demander via AskUserQuestion : "Fichiers archivés. Tu veux que je supprime les originaux du repo ?"
- Si oui → `trash` (jamais `rm`)

### Flow `search`

1. `grep -ri "<query>" ~/.config/gerber-vault/` avec contexte (-C 2)
2. Filtrer les INDEX.md des résultats (bruit)
3. Afficher les résultats groupés par projet

### Flow `status`

1. Lire `~/.config/gerber-vault/INDEX.md`
2. Afficher le tableau
3. Si le fichier n'existe pas → "Vault vide ou non initialisé"

### Flow `index`

**Agent Sonnet (background) :**

1. Scanner chaque dossier projet dans le vault
2. Pour chaque projet : régénérer INDEX.md depuis les fichiers présents
3. Régénérer INDEX.md global depuis les INDEX.md projets
4. Commit + push

## Agent `gerber-agent-vault`

- **Modèle** : Sonnet
- **Outils** : Bash, Read, Write, Glob, Grep
- **Lancement** : toujours en background (`run_in_background: true`)
- **Rôle** : exécution mécanique (copie, index, git). Pas de décision, pas d'interaction utilisateur.

## Ce qui disparaît

- La skill `/gerber-cold-storage` (remplacée par `/gerber-vault`)
- L'agent `gerber-agent-notebook` pour le cold storage
- Les fichiers `.gerber-nlm` dans les repos
- La dépendance NotebookLM pour l'archivage projet

## Ce qui reste inchangé

- `/deep-research-notebook` continue d'utiliser NotebookLM (notebooks jetables, use case différent)
- Toutes les autres skills gerber-* ne sont pas touchées

## Pré-requis

- Créer le repo privé GitHub (ex: `recarnot/gerber-vault`)
- `git clone` dans `~/.config/gerber-vault/`
- SSH key configurée pour push sans prompt
