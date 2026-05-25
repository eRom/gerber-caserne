---
name: onboarding
description: "Initialise un projet : Linear, repo GitHub, _gerber_/, vault RAG Gerber, et section Linear dans AGENTS.md. Use when l'utilisateur demande d'onboarder ou initialiser un projet."
user-invocable: true
---

# onboarding

Initialise un projet dans l'ecosysteme Gerber pour Codex.

## Decisions figees

- Workspace Linear : `eRom`
- Team Linear : `eRom-Agents`
- Owner GitHub : `eRom`
- Visibilite GitHub : private
- `_gerber_/` est versionne, jamais ignore
- Enregistrement vault Gerber obligatoire

## Prechecks

- `gh auth status`, sinon demander a l'utilisateur de lancer `gh auth login`.
- Verifier que les MCP Linear et Gerber sont disponibles. Si Gerber retourne 401, signaler `GERBER_TOKEN` absent ou invalide.

## Detecter le nom

Ordre :
1. `git remote get-url origin`, dernier segment sans `.git`.
2. `basename "$PWD"`.
3. Demander le nom du projet.

Deriver :
- Linear : Title Case avec espaces.
- GitHub : kebab-case lowercase.

## Disponibilite

- Linear : chercher un project strictement egal au nom Linear dans `eRom-Agents`.
- GitHub : `gh repo view eRom/<nom_github> --json name`.
- Si l'un existe, demander un autre nom.

## Confirmation

```text
Je vais creer :
  - Linear     : <nom_linear>      (team eRom-Agents)
  - Repository : eRom/<nom_github> (prive)
  - Vault RAG  : OK

On y va ? (oui/non)
```

Stopper si non.

## Creation

1. Creer le projet Linear avec team `eRom-Agents`. Sur erreur, stopper.
2. Initialiser Git si `.git/` absent.
3. Si `origin` absent, creer le repo GitHub prive avec `gh repo create eRom/<nom_github> --private --source=. --remote=origin`.
4. Si `origin` pointe ailleurs, demander quoi faire.
5. Creer `_gerber_/` si absent.
6. Retirer `_gerber_/` du `.gitignore` s'il y figure, sans autre nettoyage.
7. Appeler le tool Gerber `rag_onboard` avec `repo: "eRom/<nom_github>"`. Rapporter l'erreur mais ne pas bloquer si Linear/GitHub sont deja crees.

## AGENTS.md

Ajouter ou remplacer uniquement la section :

```markdown
## Linear

- **Project** : <nom_linear>  (`<project_id>`)
```

Si `AGENTS.md` absent, le creer avec `# AGENTS.md - <nom_linear>` puis la section.

Ne rien ajouter d'autre : les IDs Airtable et Linear globaux vivent dans `~/.codex/GERBER.md`.

## Commit et push

Si changements locaux :
- staging cible : `git add AGENTS.md`, puis `git add .gitignore` seulement si `.gitignore` existe et a change
- demander avant d'inclure des fichiers non trackes a la racine
- commit : `chore: onboard project - AGENTS.md + Linear`
- push sur upstream, ou `git push -u origin <branch>` si absent

## Recap

```text
Projet "<nom_linear>" initialise.

  [x] Linear        : <project_url>
  [x] GitHub        : https://github.com/eRom/<nom_github>
  [x] _gerber_/     : <PWD>/_gerber_/
  [x] Vault RAG     : <added | already_registered | error>
  [x] AGENTS.md     : section ## Linear ecrite
  [x/skipped] Commit + push : <sha court> sur <branch>
```

## Contraintes

- Toujours confirmer avant creations distantes.
- Ne jamais toucher a un `origin` qui pointe ailleurs sans demander.
- Noms Linear et GitHub identiques modulo casing.
