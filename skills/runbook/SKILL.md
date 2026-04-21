---
name: runbook
description: "Create or update a project runbook (run_cmd, url, env) by reading the repo stack."
user-invocable: true
---

# /gerber:runbook — Compose project runbook

## Role

Tu es un **technicien onboarding**. Ton job : lire un repo et composer un runbook minimal (commande de lancement, URL attendue, env) pour qu'il puisse etre lance en un appui de touche depuis la TUI gerber.

## Invocation

```
/gerber:runbook [slug]
```

`slug` optionnel — si absent, tu cherches le projet dont `repoPath` correspond au cwd.

## Procedure

### 1. Resoudre le projet

Appelle `project_list` via le MCP gerber. Filtre par slug (si fourni) ou par `repoPath` matching le cwd. Si ambigu ou introuvable, demande a Romain.

### 2. Lire la stack

Lis (selon ce qui existe) :

- `package.json` → `scripts.dev`, `scripts.start`, `scripts.serve`, `packageManager`
- `Cargo.toml` → `[[bin]]`, `default-run`
- `pyproject.toml` / `uv.lock` → `[project.scripts]`, `tool.uv`
- `docker-compose.yml` → services + ports
- `pnpm-workspace.yaml` / `turbo.json` / `lerna.json` → detecter monorepo

Ne lis **pas** tout le repo — juste les fichiers ci-dessus + un README si vraiment utile.

### 3. Identifier l'URL

- `vite.config.*` → `server.port` (defaut 5173)
- `next.config.*` → env PORT ou 3000
- `package.json` scripts → flags `--port`
- Fallback : laisse `url` null

### 4. Composer la commande

- Single service → directe (`pnpm dev`, `cargo run`, `uv run app.py`)
- Monorepo multi-services → propose `concurrently -n a,b -c blue,magenta "cmd1" "cmd2"`
- Python venv → `uv run ...` ou `.venv/bin/python ...`

Utilise le package manager declare (`packageManager` field) : pnpm, bun, ou npm. Jamais yarn sans evidence explicite.

### 5. Presenter le runbook propose

Montre à l'utilisateur ton proposal sous forme de diff par rapport au runbook actuel (ou vide si nouveau) :

```
run_cmd : pnpm --filter @agent-brain/ui dev
url     : http://localhost:5173
run_cwd : (vide = repo root)
env     : (aucun)
```

Demande confirmation.

### 6. Ecrire via MCP

Appelle `project_set_runbook` avec les champs valides.

### 7. Resumer en une ligne

> Runbook ecrit pour `<slug>`. Lance-le depuis la TUI : Home → projet → [g]o.

## Cas limites

- **Repo sans package manager detecte** : demande a Romain la commande manuelle
- **Monorepo complexe** : propose une commande `concurrently` nommee, demande validation fine
- **Port introuvable** : laisse `url` null plutot que d'inventer
- **Projet non indexe dans gerber** : redirige vers `/gerber:onboarding` d'abord

## Ne fais pas

- N'invente pas de port
- Ne prends pas `start` si `dev` existe (le dev UX est prioritaire)
- Ne touche pas a `.env` / `.env.local` — utilise uniquement le champ `env` du runbook
- Ne lance pas le projet — ton job s'arrete a l'ecriture du runbook
