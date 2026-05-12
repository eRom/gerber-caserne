# P-3 : Plugin Claude Code remote MCP — Implementation Plan

> **For agentic workers:** Execute inline (controller).

**Goal:** Transformer le plugin `gerber-caserne` d'un plugin "skills-only avec MCP local stdio" en un plugin "skills + MCP HTTP remote". Casse l'install actuelle (breaking change → v2.0.0).

**Architecture:** Ajout d'un `.mcp.json` à la racine déclarant le MCP server distant en HTTP (bearer auth via `${GERBER_TOKEN}`). Skill `onboarding` modifiée pour prompter + persister le token. Hook `gerber-poll.sh` migré pour utiliser l'URL distante.

**Pré-requis:**
- ✅ P-2 mergée — MCP `gerber.mcp.romain-ecarnot.com` accessible avec bearer
- ✅ Token bearer existe dans `secrets/gerber.enc.yaml` (rapatriable via `sops -d`)

---

### Task 1 : Créer `.mcp.json` à la racine du plugin

Contenu :
```json
{
  "mcpServers": {
    "gerber": {
      "type": "http",
      "url": "https://gerber.mcp.romain-ecarnot.com/mcp/stream",
      "headers": {
        "Authorization": "Bearer ${GERBER_TOKEN}"
      }
    }
  }
}
```

---

### Task 2 : Migrer `hooks/gerber-poll.sh`

Remplacer `http://127.0.0.1:4000` par `https://gerber.mcp.romain-ecarnot.com`. Ajouter le header bearer. Fail gracefully si `GERBER_TOKEN` absent (skip silencieux, pas d'erreur dans la session).

Comportement attendu :
- Si `$GERBER_TOKEN` empty → `exit 0` (utilisateur pas encore onboardé)
- Si URL down ou 401 → `exit 0` (pas de erreur, juste skip ce poll)
- Si OK → comportement actuel (poll messages + tasks inbox)

---

### Task 3 : Modifier skill `gerber:onboarding`

Ajouter Étape 0.5 (entre 0 et 1) : check token.

Pseudo-flow :
1. Vérifier `process.env.GERBER_TOKEN` (lu depuis `~/.claude/settings.local.json` section `env`)
2. Si absent : prompter "Colle ton bearer gerber (généré via `sops -d secrets/gerber.enc.yaml` sur le repo vps-docker-manager-prod)"
3. Écrire dans `~/.claude/settings.local.json` :
   ```json
   { "env": { "GERBER_TOKEN": "..." } }
   ```
4. Tester connectivité : `curl /health` avec bearer → 200 attendu
5. Si 401 → re-prompter
6. Si OK → continuer flow normal

---

### Task 4 : Bump `plugin.json` version 1.5.3 → 2.0.0

Et update description si pertinent pour refléter le changement remote vs local.

---

### Task 5 : Update README quickstart

Nouveau quickstart :
```
/plugin install gerber@erom-marketplace
/reload-plugins
/gerber:onboarding   # prompts for bearer token + initializes project
```

Supprimer toute mention de `pnpm install && pnpm build` côté utilisateur (le MCP tourne sur VPS, l'utilisateur n'a rien à builder).

---

### Task 6 : Commit + push + tag v2.0.0

Tag = `v2.0.0` (plugin version, séparé du tag MCP `gerber-v*`).

---

## Critère de succès

- [ ] `.mcp.json` créé
- [ ] `gerber-poll.sh` utilise URL distante + bearer + skip si token absent
- [ ] `onboarding/SKILL.md` documente le flow token
- [ ] `plugin.json` à v2.0.0
- [ ] README à jour
- [ ] Tag `v2.0.0` poussé
- [ ] Test : sur une session Claude Code reload, `mcp__gerber__project_list` retourne les 24 projets via le MCP VPS (pas le local)
