---
name: setup-code
description: Initialise les settings.json et GEMINI.md suivant la stack technique
user-invocable: true
---

# setup-code

## Étape 1 — `.agents/settings.json`

Créer `.agents/` si absent. Si `settings.json` existe, conserver les autres clés et ne merger QUE `enabledPlugins`.

**Détecter la stack**, dans cet ordre :
1. Contexte de session (brainstorm/spec en cours) — source primaire, fonctionne sur repo vide.
2. Fichiers projet (package.json, Cargo.toml, pyproject.toml, Dockerfile…).

**Mapper stack → plugins** (plusieurs règles peuvent s'appliquer, dédupliquer) :

| Stack | Plugins |
|---|---|
| TypeScript / JavaScript | vtsls |
| Frontend (React, Next, Vite, Svelte, Nuxt…) | vtsls + chrome-devtools-mcp + playwright + frontend-design |
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

`security-guidance@claude-plugins-official` **toujours activé**.

**Clés complètes possibles** :
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

## Étape 2 — Sections GEMINI.md

Idempotent : si une section `##` existe, la mettre à jour sans dupliquer. Conserver tout le reste intact.

### `## LSP Tools` — si au moins un plugin `*@claude-code-lsps` est activé

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

### `## Browser Tools` — si `chrome-devtools-mcp` OU `playwright` activé

```markdown
## Browser Tools

| Tool | Plugin | Use for |
|------|--------|---------|
| chrome-devtools skills | chrome-devtools-mcp | Debugging, performance, network, console, screenshots |
| Playwright | playwright | E2E tests, headless automation, multi-browser |
```

## Étape 3 — Commit (si modifs)

```bash
git add .agents/settings.json GEMINI.md
git commit -m "chore: configure Gemini settings and GEMINI.md for stack"
```

Pas de commit si rien n'a changé.
