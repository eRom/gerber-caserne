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
- `/gerber:rag` — recherche RAG dans le vault Gemini cross-projets 
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

## Etape 6 — Enregistrer le projet dans le vault gerber (optionnel)

Le vault `eRom/gerber-vault` indexe automatiquement les paths whitelistes des projets satellite dans le FileSearchStore Gemini, accessible via `/gerber:rag`. Cron 15min, zero conf cote satellite (pas de workflow a creer dans ce repo).

Demander :

```
Veux-tu enregistrer ce projet dans le vault gerber (RAG cross-projets) ?

(oui/non)
```

Si **non** -> skip, passer a l'Etape 7.

Si **oui** :

### 6a — Detecter le remote GitHub

```bash
git remote get-url origin
```

Extraire `owner/name` du remote (formats acceptes : `https://github.com/owner/name.git`, `git@github.com:owner/name.git`).

Si pas de remote GitHub :
```
Le projet doit avoir un remote GitHub pour etre vault-e (le pipeline gerber-vault pull les satellites via GitHub API).
Configure le remote puis relance /gerber:onboarding.
```
Skip et passer a l'Etape 7.

### 6b — Demander les paths a vault-er

```
Quels paths du repo veux-tu indexer dans le RAG ?
Defaut : CLAUDE.md, AGENTS.md, GEMINI.md, README.md, docs/, .cave/
(Entree pour accepter, ou liste personnalisee separee par espaces)
```

Note : un path inexistant cote satellite sera silencieusement skip cote pull-sources. Pas grave d'inclure des paths qui n'existent pas encore.

### 6c — Verifier la presence de GERBER_VAULT_HUB

Le PAT `GERBER_VAULT_HUB` doit etre dans l'environnement (Contents:RW sur `eRom/gerber-vault`).

```bash
test -n "$GERBER_VAULT_HUB" && echo "OK" || echo "MISSING"
```

Si MISSING :
```
Variable GERBER_VAULT_HUB manquante.
Cree un PAT fine-grained avec Contents:RW sur eRom/gerber-vault uniquement, puis :
  export GERBER_VAULT_HUB="<token>"  (et persister dans ~/.zshenv)

Skill /github-pat dispo pour le runbook.
```
Skip et passer a l'Etape 7.

### 6d — Mettre a jour le clone local de gerber-vault

```bash
test -d ~/.config/gerber-vault/.git || git clone "https://${GERBER_VAULT_HUB}@github.com/eRom/gerber-vault.git" ~/.config/gerber-vault
cd ~/.config/gerber-vault && git pull --ff-only
```

### 6e — Idempotence : verifier que le projet n'est pas deja enregistre

```bash
grep -E "^\s*-\s*repo:\s*${OWNER}/${NAME}\s*$" ~/.config/gerber-vault/sources.yml
```

Si match -> afficher `Projet deja enregistre dans gerber-vault, skip.` et passer a l'Etape 7.

### 6f — Ajouter l'entree dans sources.yml

Ajouter en fin de la liste `sources:` (en YAML, avec les paths choisis) :

```yaml
  - repo: {OWNER}/{NAME}
    paths:
      - CLAUDE.md
      - AGENTS.md
      - GEMINI.md
      - README.md
      - docs/
      - .cave/
    added: {YYYY-MM-DD}
```

(Adapter `paths:` selon la reponse de l'utilisateur. `added:` = date du jour.)

### 6g — Commit + push

```bash
cd ~/.config/gerber-vault
git add sources.yml
git commit -m "vault: register {OWNER}/{NAME}"
git push
```

Le push declenche le workflow `pull-sources.yml` au prochain cron (15min max). Premier RAG dispo dans 15-30min.

### 6h — Trigger immediat (optionnel)

Proposer :
```
Lancer le pull immediatement (sans attendre le cron) ?
(oui/non)
```

Si oui :
```bash
gh workflow run pull-sources.yml --repo eRom/gerber-vault
gh workflow run bootstrap-rag.yml --repo eRom/gerber-vault -f slug={NAME}
```

Le premier `pull-sources` ramene les fichiers cote vault, le `bootstrap-rag` les indexe dans Gemini. Compter ~2-3min pour les deux.

## Etape 7 — Confirmation finale

Afficher :

```
Projet << {slug} >> initialise dans gerber.

  [x] Workspace (.cave/)
  [x] Projet cree dans gerber
  [x] .cave/.gerber-slug
  [x] CLAUDE.md § Gerber + § Contexte projet (.cave)
  [x/skipped] Vault gerber (enregistre dans eRom/gerber-vault, RAG dispo via /gerber:rag dans 15-30min)
```
