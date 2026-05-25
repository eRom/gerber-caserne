---
description: "Bump les 3 plugins (claude/codex/gemini) + 2 marketplaces ISO, build gerber.zip, commit & push"
model: sonnet
argument-hint: "patch | minor | major"
allowed-tools: Bash, Read, Edit
color: red
---

Workflow release du plugin `gerber`. Le plugin existe en **3 déclinaisons** (un seul numéro de version, partagé) :

| Agent | plugin.json |
|---|---|
| **Claude (MASTER)** | `gerber-claude-plugin/.claude-plugin/plugin.json` |
| Codex | `gerber-codex-plugin/.codex-plugin/plugin.json` |
| Antigravity/Gemini | `gerber-gemini-plugin/plugin.json` |

La version **Claude est la source de vérité**. Les 2 autres plugins ET les 2 marketplaces doivent toujours être **ISO** (même numéro de version).

Argument : $ARGUMENTS (defaut: patch)

## Pre-requis

- Le repo `gerber-caserne` est le repo courant (CWD).
- Le repo `erom-marketplace` est cloné en `/Users/recarnot/dev/erom-marketplace` et le working tree est propre. Si dirty, prévenir l'utilisateur et stopper.
- Avant de commencer : vérifier que les 3 plugins sont déjà ISO entre eux (même version). Si l'un diverge, le signaler — on partira quand même de la version Claude (master) comme base de bump.

## Etapes

1. **Lire** la version courante depuis le MASTER : `gerber-claude-plugin/.claude-plugin/plugin.json`.

2. **Bumper** selon l'argument (`patch` | `minor` | `major`, defaut `patch`) :
   - patch : `X.Y.Z` -> `X.Y.(Z+1)`
   - minor : `X.Y.Z` -> `X.(Y+1).0`
   - major : `X.Y.Z` -> `(X+1).0.0`

3. **Ecrire** `<NEW_VERSION>` dans les **3 plugin.json** via Edit (remplacer uniquement la ligne `"version": "..."` de chaque fichier) :
   - `gerber-claude-plugin/.claude-plugin/plugin.json`
   - `gerber-codex-plugin/.codex-plugin/plugin.json`
   - `gerber-gemini-plugin/plugin.json`

4. **Builder** le zip Claude (gitignore, distribution manuelle/test) :
   ```bash
   trash gerber.zip 2>/dev/null; zip -r gerber.zip gerber-claude-plugin -x "*.DS_Store" -x "*/.DS_Store" -x "__MACOSX/*"
   ```
   Note : la vraie source du plugin Claude est dans `gerber-claude-plugin/` (skills, hooks, agents, .mcp.json), pas à la racine.

5. **Verifier** `git status` du repo courant — seuls les **3 plugin.json** doivent etre modifies (gerber.zip doit rester ignore). Chaque fichier vit DANS le dossier de son plugin (convention Claude Code depuis 2026-05-18).

6. **Commit + push** côté `gerber-caserne` :
   ```bash
   git add gerber-claude-plugin/.claude-plugin/plugin.json \
           gerber-codex-plugin/.codex-plugin/plugin.json \
           gerber-gemini-plugin/plugin.json
   git commit -m "chore(release): bump plugin to <NEW_VERSION>"
   git push
   ```

7. **Bump des 2 marketplaces** (sinon les agents restent sur l'ancienne version cachée) :

   - **Marketplace Claude** — Edit `/Users/recarnot/dev/erom-marketplace/.claude-plugin/marketplace.json` :
     dans l'entrée du plugin `"name": "gerber"`, remplacer sa ligne `"version": "..."` par `<NEW_VERSION>`.
     ⚠️ Ne PAS toucher la `"version"` de tête du marketplace (sa version propre, ex. `0.3.4`) — viser uniquement la version DANS l'entrée plugin gerber.

   - **Marketplace agents (codex/gemini)** — Edit `/Users/recarnot/dev/erom-marketplace/.agents/plugins/marketplace.json` :
     dans l'entrée du plugin `"name": "gerber"`, mettre/ajouter `"version": "<NEW_VERSION>"`.
     - Si une ligne `"version": "..."` existe déjà dans l'entrée gerber → la remplacer.
     - Sinon → l'ajouter juste après la ligne `"name": "gerber",` de l'entrée.

   - **Commit + push** dans le repo erom-marketplace :
     ```bash
     cd /Users/recarnot/dev/erom-marketplace
     git add .claude-plugin/marketplace.json .agents/plugins/marketplace.json
     git commit -m "chore: bump gerber to <NEW_VERSION>"
     git push
     cd -
     ```

8. **Retourner** un resume court :
   - ancienne version -> nouvelle version
   - les 5 fichiers mis à jour (3 plugins + 2 marketplaces), confirmés ISO
   - taille du zip
   - SHA du commit gerber-caserne
   - SHA du commit erom-marketplace
   - rappel pour le user : `/plugin update gerber` ou `/plugin marketplace refresh` côté Claude Code (et l'équivalent côté Codex/Antigravity) pour récupérer la nouvelle version.

## Regles

- Ne commit PAS `gerber.zip` (verifier qu'il est bien ignore par `.gitignore`).
- Côté `gerber-caserne` : ne commit QUE les 3 plugin.json. Si d'autres fichiers sont stages, stop et demande.
- Côté `erom-marketplace` : ne commit QUE les 2 marketplace.json. Si d'autres fichiers sont stages, stop et demande.
- La version Claude est le MASTER : les 4 autres fichiers s'alignent dessus, jamais l'inverse.
- Si l'un des working trees a des modifs non liees avant de commencer, prevenir l'utilisateur avant de continuer.
- Si le repo `erom-marketplace` n'existe pas en `/Users/recarnot/dev/erom-marketplace`, stop et demander à l'user où il vit.
