---
description: "Bump plugin.json, build gerber.zip, commit & push"
model: sonnet
argument-hint: "patch | minor | major"
allowed-tools: Bash, Read, Edit
color: red
---

Workflow release du plugin `gerber`.

Argument : $ARGUMENTS (defaut: patch)

## Etapes

1. **Lire** `.claude-plugin/plugin.json` et extraire la version actuelle.
2. **Bumper** selon l'argument (`patch` | `minor` | `major`, defaut `patch`) :
   - patch : `X.Y.Z` -> `X.Y.(Z+1)`
   - minor : `X.Y.Z` -> `X.(Y+1).0`
   - major : `X.Y.Z` -> `(X+1).0.0`
3. **Ecrire** la nouvelle version dans `.claude-plugin/plugin.json` via Edit (remplacer uniquement la ligne `"version": "..."`).
4. **Builder** le zip (le fichier `gerber.zip` est gitignore) :
   ```bash
   trash gerber.zip 2>/dev/null; zip -r gerber.zip .claude-plugin skills hooks -x "*.DS_Store" -x "*/.DS_Store" -x "__MACOSX/*"
   ```
5. **Verifier** `git status` — seul `.claude-plugin/plugin.json` doit etre modifie (gerber.zip doit etre ignore).
6. **Commit + push** :
   ```bash
   git add .claude-plugin/plugin.json
   git commit -m "chore(release): bump plugin to <NEW_VERSION>"
   git push
   ```
7. **Retourner** un resume court : ancienne version -> nouvelle version, taille du zip, SHA du commit.

## Regles

- Ne commit PAS `gerber.zip` (verifier qu'il est bien ignore par `.gitignore`).
- Ne commit QUE `plugin.json`. Si d'autres fichiers sont stages, stop et demande.
- Si le working tree a des modifs non liees avant de commencer, prevenir l'utilisateur avant de continuer.
