---
name: code-setup
description: Initialise les settings.json et CLAUDE.md suivant la stack technique
user-invocable: true
---

# Skill: code-setup

Tu configures les settings et le CLAUDE.md du repo courant.

## Étape 1 — Projet settings.json

1. Si le dossier `.claude/` n'existe pas à la racine du repo courant, le créer.
2. Si `.claude/settings.json` existe, l'analyser pour conserver les clés existantes.
3. Déterminer la stack technique — dans cet ordre de priorité :
   - **1. Contexte de session** : utiliser la stack définie dans le brainstorm ou la spec en cours (source primaire, fonctionne même sur repo vide)
   - **2. Fichiers projet** : si aucun contexte en session, scanner package.json, Cargo.toml, pyproject.toml, Dockerfile, etc.

Sélectionner les plugins à activer selon ces règles :

| Stack détectée | Plugins à activer |
|---|---|
| TypeScript / JavaScript | vtsls |
| Frontend (React, Next.js, Vite, Svelte, Nuxt…) | vtsls + chrome-devtools-mcp + playwright + frontend-design |
| Rust / Cargo | rust-analyzer |
| Python | pyright |
| Apple Swift | sourcekit-lsp |
| Claude SDK / Plugin dev | agent-sdk-dev + plugin-dev |
| Docker / VPS / serveur | hostinger + yaml-language-server |
| Cloudflare Workers / Pages | cloudflare + vtsls |
| Vercel deployment | vercel-plugin + vtsls |
| CI/CD YAML lourd (GitHub Actions, K8s…) | yaml-language-server |
| Shell scripts | bash-language-server |
| Design system / tokens | design-tokens + frontend-design |

`security-guidance@claude-plugins-official` est **toujours activé** (défaut).

Plusieurs règles peuvent s'appliquer simultanément — dédupliquer les plugins.

Liste complète :
```json
"enabledPlugins": {
  "chrome-devtools-mcp@claude-plugins-official": true|false,
  "playwright@claude-plugins-official": true|false,
  "agent-sdk-dev@claude-plugins-official": true|false,
  "frontend-design@claude-plugins-official": true|false,
  "security-guidance@claude-plugins-official": true|false,
  "plugin-dev@claude-plugins-official": true|false,
  "vercel-plugin@vercel-vercel-plugin": true|false,
  "design-tokens@w3c-design-tokens-agent-skill": true|false,
  "hostinger@erom-marketplace": true|false,
  "vtsls@claude-code-lsps": true|false,
  "rust-analyzer@claude-code-lsps": true|false,
  "pyright@claude-code-lsps": true|false,
  "yaml-language-server@claude-code-lsps": true|false,
  "bash-language-server@claude-code-lsps": true|false,
  "sourcekit-lsp@claude-code-lsps": true|false,
  "cloudflare@cloudflare": true|false
}
```

4. Merger uniquement la clé `enabledPlugins` dans `.claude/settings.json`. Ne pas toucher les autres clés (`permissions`, `hooks`, etc.). Si le fichier n'existe pas, le créer avec uniquement `enabledPlugins`.

Exemple de résultat :
```json
{
  "enabledPlugins": {
    "chrome-devtools-mcp@claude-plugins-official": true,
    "playwright@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "vtsls@claude-code-lsps": true
  }
}
```

## Étape 2 — Configurer CLAUDE.md

Ouvrir le fichier `CLAUDE.md` à la racine du repo courant.

**Règle d'idempotence** : si une section existe déjà (même titre `##`), la mettre à jour sans la dupliquer. Conserver intégralement le contenu existant non concerné (commandes, gerber, gotchas, patterns…).

### Section LSP Tools

Si au moins un plugin LSP est activé parmi :
- vtsls@claude-code-lsps
- rust-analyzer@claude-code-lsps
- pyright@claude-code-lsps
- yaml-language-server@claude-code-lsps
- bash-language-server@claude-code-lsps
- sourcekit-lsp@claude-code-lsps

Alors ajouter ou mettre à jour la section `## LSP Tools` :

```markdown
## LSP Tools

A builtin tool with 9 operations mapping directly to LSP commands:

| Operation              | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `goToDefinition`       | Find where a symbol is defined                                  |
| `findReferences`       | Find all references to a symbol                                 |
| `hover`                | Get hover info (docs, type info) for a symbol                   |
| `documentSymbol`       | Get all symbols (functions, classes, variables) in a document   |
| `workspaceSymbol`      | Search for symbols across the entire workspace                  |
| `goToImplementation`   | Find implementations of an interface/abstract method            |
| `prepareCallHierarchy` | Get call hierarchy item at a position                           |
| `incomingCalls`        | Find all functions/methods that call the function at a position |
| `outgoingCalls`        | Find all functions/methods called by the function at a position |
```

### Section Browser Tools

Si `chrome-devtools-mcp@claude-plugins-official` ou `playwright@claude-plugins-official` est activé, ajouter ou mettre à jour la section `## Browser Tools` :

```markdown
## Browser Tools

| Tool | Plugin | Use for |
|------|--------|---------|
| chrome-devtools skills | chrome-devtools-mcp | Debugging, performance, network, console, screenshots |
| Playwright | playwright | E2E tests, headless automation, multi-browser |
```

## Étape 3 — Commit

Si au moins un fichier a changé, commiter :

```bash
git add .claude/settings.json CLAUDE.md
git commit -m "chore: configure Claude Code settings and CLAUDE.md for stack"
```

Si aucun fichier n'a changé (tout était déjà à jour), ne pas commiter.
