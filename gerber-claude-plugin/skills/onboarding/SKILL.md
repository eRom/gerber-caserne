---
name: onboarding
description: "Initialise un projet dans gerber et configure le CLAUDE.md du repo courant."
user-invocable: true
---

# Skill: onboarding

Tu initialises un projet dans Gerber et configures le CLAUDE.md du repo courant.

## Arguments

- `[slug]` (optionnel) : identifiant du projet. Si absent, utilise `basename "$PWD"`.

## Etape 0 — Resoudre le slug (pre requis)

Si un argument a ete fourni apres `/gerber:onboarding`, utilise-le comme slug.
Sinon, determine le slug via `basename "$PWD"`.

## Etape 0.5 — Configurer le bearer `GERBER_TOKEN` (idempotent)

Le plugin parle a un MCP server distant (`https://gerber.mcp.romain-ecarnot.com/mcp/stream`) protege par bearer auth. Le token doit etre present dans la variable d'environnement `GERBER_TOKEN` exposee par Claude Code.

1. **Verifier la presence du token** : appeler `mcp__gerber__project_list`.
   - Si l'appel **reussit** : le token est deja configure et valide. Passer a l'Etape 1.
   - Si l'appel echoue avec 401/Unauthorized OU ne peut pas joindre le serveur : continuer ci-dessous.

2. **Demander le token a l'utilisateur** :

   ```
   Bearer token gerber non configure (ou invalide).
   
   Pour le recuperer (single-user, hosted sur le VPS perso) :
     sops -d /Users/recarnot/dev/vps-docker-manager-prod/secrets/gerber.enc.yaml \
       | grep GERBER_BEARER_TOKEN | awk '{print $2}' | tr -d '"'
   
   Colle le token ici :
   ```

3. **Persister le token** dans `~/.claude/settings.json` (config globale Claude Code), section `env` :
   - Merger la cle `env.GERBER_TOKEN` (preserver les autres entrees existantes, notamment `permissions`, `hooks`, `statusLine`, etc.)
   - Utiliser `jq` ou un script Python prudent pour ne rien casser (le fichier contient toute la config Claude Code de l'utilisateur).
   - Mode `0o600` sur le fichier (contient un secret).
   - **Important** : `~/.claude/settings.local.json` n'est PAS lu par Claude Code pour l'interpolation des env vars dans `.mcp.json`. Il faut bien le `settings.json` global.

4. **Redemarrer Claude Code** (ou au minimum `/reload-plugins` puis fermer/rouvrir la session) pour que la nouvelle valeur soit injectee dans `${GERBER_TOKEN}` du `.mcp.json`. Sans redemarrage, le plugin continuera a voir l'ancienne valeur (ou rien).

5. **Si l'utilisateur veut remettre a plus tard** : terminer la skill avec un message clair. Le plugin est utilisable apres redemarrage de Claude Code.

## Etape 1 — Initialisation workspace

1. Configurer le repo Git :

- Si un repo git **n'existe pas** : Faire un `git init`
- Si un repo git **existe deja** : ne rien faire.

2. Configurer le dossier `.cave/` :
- Si le dossier **n'existe pas** : Creer le dossier `.cave/` dans le projet

Note : `.cave/` n'est PAS gitignore — il est versionne avec le projet.

## Etape 2 — Verifier si le projet existe deja

Appeler `mcp__gerber__project_list` (sans parametres).

Chercher dans la reponse un projet dont le `slug` correspond au slug resolu.

- Si le projet **existe deja** : noter son `id`.
  - Si son `repoPath` est vide OU different du `$PWD` courant : appeler `mcp__gerber__project_update` avec `{ id, repoPath: "$PWD" }` pour synchroniser le chemin. Afficher `Path projet mis a jour : {ancien} -> {PWD}`.
  - Passer directement a l'Etape 4 (slug file).
- Si le projet **n'existe pas** : passer a l'Etape 3 (creation).

## Etape 3 — Creer le projet

Demander confirmation a Romain avant de creer :

```
Projet << {slug} >> introuvable dans agent-brain.
Je vais creer :
  - slug     : {slug}
  - name     : {slug} (peut etre modifie)
  - repoPath : {PWD}

On y va ? (oui/non)
```

Si confirmation recue, appeler `mcp__gerber__project_create` avec :
- `slug` : le slug resolu
- `name` : le slug (ou le nom donne par l'utilisateur)
- `repoPath` : le repertoire courant

Verifier que la reponse contient un `id` valide. Si erreur, rapporter et STOPPER.

## Etape 4 — Creer `.cave/.gerber-slug`

Creer (ou ecraser) le fichier `.cave/.gerber-slug` contenant uniquement le slug suivi d'un saut de ligne.

Ce fichier est lu par le hook `gerber-poll.sh` au demarrage de session pour resoudre le slug du projet.

## Etape 5 — Configurer le CLAUDE.md

Ouvrir le fichier `CLAUDE.md` a la racine du repo courant.

### Section `## Gerber`

Chercher une section `## Gerber`.

- Si elle **existe deja** : la mettre a jour avec le contenu ci-dessous.
- Si elle **n'existe pas** : l'ajouter a la fin du fichier.

Contenu de la section a inserer/remplacer :

```markdown
## Gerber

Ce projet est indexe dans **gerber** sous le slug `{slug}`.
Slug cross-projet : `caserne` (design system, conventions, preferences personnelles). Pour les sujets design/UI, conventions, stack : chercher aussi dans `caserne`.

Entites :
- **Notes** (atoms + documents) — memoire de connaissance, recherche semantique/fulltext
- **Tasks** — taches projet avec kanban 7 colonnes (inbox -> brainstorming -> specification -> plan -> implementation -> test -> done)
- **Issues** — problemes/bugs avec kanban 4 colonnes (inbox -> in_progress -> in_review -> closed)
- **Messages** — bus inter-sessions (context + reminder)

Skills disponibles :
- `/gerber:recall` — recherche contextuelle dans la memoire cross-projets
- `/gerber:capture` — capture rapide d'un atome de connaissance
- `/gerber:archive` — extraction et archivage fin de session
- `/gerber:session-complete` — cartographie de fin de session (.cave/ + archive)
- `/gerber:review` — maintenance hebdomadaire (notes, tasks, issues)
- `/gerber:import` — migration one-shot depuis .cave/
- `/gerber:inbox` — consulter les messages inter-sessions
- `/gerber:send` — envoyer un message inter-session
- `/gerber:task` — gestion des taches projet (kanban)
- `/gerber:issue` — gestion des issues projet
- `/gerber:vault` — archivage cross-projets dans un vault git
- `/gerber:runbook` — composer le runbook d'un projet (run_cmd, url, env) depuis la stack du repo
```

Remplacer `{slug}` par la valeur resolue.

### Section `## Contexte projet (.cave)`

Chercher une section `## Contexte projet`.

- Si elle **existe deja** : la mettre a jour.
- Si elle **n'existe pas** : l'ajouter apres la section `## Gerber`.

Contenu :

```markdown
## Contexte projet (.cave)

Le dossier `.cave/` contient la cartographie persistante du projet :
- `architecture.md` — vue d'ensemble, stack, flux de donnees
- `key-files.md` — fichiers critiques et leur role
- `patterns.md` — conventions et patterns recurrents
- `gotchas.md` — pieges, bugs resolus, workarounds

**Ne lis PAS ces fichiers au demarrage.** Lis-les a la demande, uniquement quand la question de l'utilisateur touche au domaine concerne (ex: question archi -> `architecture.md`, bug etrange -> `gotchas.md`). Pour une question triviale ou sans rapport avec le projet lui-meme, ne les lis pas du tout.
```

## Etape 8 — Configurer le vault Gemini (optionnel)

Demander :

```
Veux-tu configurer la synchronisation Gemini Vault pour ce projet ?
Cela va :
  - ecrire .github/workflows/vault.yml (sync automatique au push)
  - ecrire .github/workflows/vault-bootstrap.yml (ingestion one-shot)
  - configurer les secrets GitHub VAULT_CORPUS_NAME et VAULT_EMBED_API_KEY

(oui/non)
```

Si **non** → skip, passer a l'Etape 9.

Si **oui** :

### 8a — Demander les chemins a surveiller

```
Quels chemins surveiller pour le sync automatique ?
Defaut : docs/** .cave/**
(appuie sur Entree pour accepter ou donne tes chemins)
```

Utiliser les chemins fournis ou le defaut `docs/** .cave/**`.
Construire la liste YAML : `["docs/**", ".cave/**"]` (adapter selon la reponse).

### 8b — Ecrire `vault.yml`

Creer `.github/workflows/vault.yml` :

```yaml
name: Vault
on:
  push:
    paths: [{PATHS_LIST}]
jobs:
  call-sync:
    uses: eRom/gemini-vault-tech/.github/workflows/sync.yml@main
    secrets:
      VAULT_EMBED_API_KEY: ${{ secrets.VAULT_EMBED_API_KEY }}
      VAULT_CORPUS_NAME: ${{ secrets.VAULT_CORPUS_NAME }}
```

Remplacer `{PATHS_LIST}` par la liste des chemins resolus (ex: `"docs/**", ".cave/**"`).

### 8c — Ecrire `vault-bootstrap.yml`

Creer `.github/workflows/vault-bootstrap.yml` :

```yaml
name: Vault Bootstrap
on:
  workflow_dispatch: {}
jobs:
  bootstrap:
    uses: eRom/gemini-vault-tech/.github/workflows/bootstrap.yml@main
    secrets:
      VAULT_EMBED_API_KEY: ${{ secrets.VAULT_EMBED_API_KEY }}
      VAULT_CORPUS_NAME: ${{ secrets.VAULT_CORPUS_NAME }}
    with:
      paths: '{PATHS_SPACE}'
```

Remplacer `{PATHS_SPACE}` par les chemins separes par des espaces (ex: `docs .cave`).

### 8d — Configurer les secrets GitHub

Verifier que le repo a un remote GitHub (`git remote get-url origin`). Si oui :

```bash
gh secret set VAULT_CORPUS_NAME --body "$VAULT_CORPUS_NAME"
gh secret set VAULT_EMBED_API_KEY --body "$VAULT_EMBED_API_KEY"
```

Si `VAULT_CORPUS_NAME` ou `VAULT_EMBED_API_KEY` ne sont pas definis dans l'environnement courant, afficher :

```
Variables VAULT_CORPUS_NAME et/ou VAULT_EMBED_API_KEY non trouvees dans l'environnement.
Configure-les manuellement :
  gh secret set VAULT_CORPUS_NAME --body "<valeur>"
  gh secret set VAULT_EMBED_API_KEY --body "<valeur>"
```

### 8e — Committer et ingerer

1. Committer les deux fichiers workflow :
   ```bash
   git add .github/workflows/vault.yml .github/workflows/vault-bootstrap.yml
   git commit -m "chore: add Gemini vault sync workflows"
   git push
   ```

2. Proposer de lancer le bootstrap immediatement :
   ```
   Veux-tu ingerer les fichiers existants maintenant via vault-bootstrap ?
   (gh workflow run vault-bootstrap.yml --ref main)
   (oui/non)
   ```
   Si oui : `gh workflow run vault-bootstrap.yml --ref main`

## Etape 9 — Confirmation finale

Afficher :

```
Projet << {slug} >> initialise dans gerber.

  [x] Workspace (.cave/)
  [x] Projet cree dans gerber
  [x] .cave/.gerber-slug
  [x] CLAUDE.md § Gerber + § Contexte projet (.cave)
  [x] Vault (~/.config/gerber-vault/)
  [x/skipped] Gemini Vault sync (.github/workflows/vault.yml + vault-bootstrap.yml)
```
