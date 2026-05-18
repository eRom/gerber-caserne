---
description: "Bump plugin.json + marketplace, build gerber.zip, commit & push"
model: sonnet
argument-hint: "patch | minor | major"
allowed-tools: Bash, Read, Edit
color: red
---

Workflow release du plugin `gerber`.

Argument : $ARGUMENTS (defaut: patch)

## Pre-requis

- Le repo `gerber-caserne` est le repo courant (CWD).
- Le repo `erom-marketplace` est cloné en `/Users/recarnot/dev/erom-marketplace` et le working tree est propre. Si dirty, prévenir l'utilisateur et stopper.

## Etapes

1. **Lire** `gerber-claude-plugin/.claude-plugin/plugin.json` du repo courant et extraire la version actuelle.

2. **Bumper** selon l'argument (`patch` | `minor` | `major`, defaut `patch`) :
   - patch : `X.Y.Z` -> `X.Y.(Z+1)`
   - minor : `X.Y.Z` -> `X.(Y+1).0`
   - major : `X.Y.Z` -> `(X+1).0.0`

3. **Ecrire** la nouvelle version dans `gerber-claude-plugin/.claude-plugin/plugin.json` via Edit (remplacer uniquement la ligne `"version": "..."`).

4. **Builder** le zip (le fichier `gerber.zip` est gitignore) — sert pour distribution manuelle/test :
   ```bash
   trash gerber.zip 2>/dev/null; zip -r gerber.zip gerber-claude-plugin -x "*.DS_Store" -x "*/.DS_Store" -x "__MACOSX/*"
   ```
   Note : la vraie source du plugin est dans `gerber-claude-plugin/` (skills, hooks, agents, .mcp.json), pas à la racine.

5. **Verifier** `git status` du repo courant — seul `gerber-claude-plugin/.claude-plugin/plugin.json` doit etre modifie (gerber.zip doit etre ignore). NB : le fichier vit DANS le dossier du plugin, plus a la racine du repo (depuis 2026-05-18, pour respecter la convention Claude Code).

6. **Commit + push** côté `gerber-caserne` :
   ```bash
   git add gerber-claude-plugin/.claude-plugin/plugin.json
   git commit -m "chore(release): bump plugin to <NEW_VERSION>"
   git push
   ```

7. **Bump du marketplace** (sinon Claude Code reste sur l'ancienne version cachée) :

   - **Edit** `/Users/recarnot/dev/erom-marketplace/.claude-plugin/marketplace.json` :
     trouver l'entrée du plugin `"name": "gerber"`, remplacer sa ligne `"version": "..."` par la `<NEW_VERSION>`.
   - **Commit + push** dans le repo erom-marketplace :
     ```bash
     cd /Users/recarnot/dev/erom-marketplace
     git add .claude-plugin/marketplace.json
     git commit -m "chore: bump gerber to <NEW_VERSION>"
     git push
     cd -
     ```

8. **Retourner** un resume court :
   - ancienne version -> nouvelle version
   - taille du zip
   - SHA du commit gerber-caserne
   - SHA du commit erom-marketplace
   - rappel pour le user : `/plugin update gerber` ou `/plugin marketplace refresh` côté Claude Code pour récupérer la nouvelle version.

## Regles

- Ne commit PAS `gerber.zip` (verifier qu'il est bien ignore par `.gitignore`).
- Côté `gerber-caserne` : ne commit QUE `plugin.json`. Si d'autres fichiers sont stages, stop et demande.
- Côté `erom-marketplace` : ne commit QUE `marketplace.json`. Si d'autres fichiers sont stages, stop et demande.
- Si l'un des working trees a des modifs non liees avant de commencer, prevenir l'utilisateur avant de continuer.
- Si le repo `erom-marketplace` n'existe pas en `/Users/recarnot/dev/erom-marketplace`, stop et demander à l'user où il vit.
