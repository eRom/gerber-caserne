---
name: vault
description: "Vault d'archives cross-projets via repo git. Sous-commandes : archive, search, status, index."
user-invocable: true
---

# vault

Vault d'archives cross-projets stocke dans un repo git local (`~/.config/gerber-vault/`).
Certaines sous-commandes deleguent a l'agent `gerber:agent-vault`, d'autres s'executent directement dans le contexte principal.

## Arguments

```
/gerber:vault <commande> [args...]
```

| Commande | Description |
|----------|-------------|
| `archive <dossier \| fichier1 fichier2 ...>` | Archiver des fichiers dans le vault |
| `search <query>` | Rechercher dans le vault |
| `status` | Afficher l'index global du vault |
| `index` | Regenerer tous les INDEX.md du vault |
| `clean` | Supprimer les dossiers projet vides (avec confirmation) |

## Résolution du slug

1. Lire `.cave/.gerber-slug` a la racine du repo courant.
2. Si absent, lire `CLAUDE.md` et chercher une section `## Gerber` contenant un slug.
3. Fallback : `basename "$PWD"`.

---

## Sous-commande : `archive`

### Pre-traitement (contexte principal — AVANT de lancer l'agent)

1. **Resoudre le slug** : `.cave/.gerber-slug` → section `## Gerber` du `CLAUDE.md` → `basename $PWD`
2. **Resoudre la liste de fichiers** :
   - Si l'argument est un **dossier** : lister recursivement tous les fichiers du dossier (Glob tool)
   - Si les arguments sont des **fichiers** : utiliser la liste telle quelle
   - Convertir tous les chemins en **chemins absolus**
3. **Pre-flight liste vide** : si la liste resolue est vide, afficher `Aucun fichier a archiver pour <slug>.` et STOPPER. Ne PAS lancer l'agent.
4. **Obtenir la racine du repo** : executer `git rev-parse --show-toplevel` depuis le dossier courant. Si echec (pas un repo git), utiliser `$PWD`.
5. **Verifier le vault** : s'assurer que `~/.config/gerber-vault/.git` existe. Si non → afficher "Vault non initialise. Le dossier `~/.config/gerber-vault/` doit etre un repo git." et STOPPER.
6. Afficher : `Archivage lance en background...`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: true` et `mode: "bypassPermissions"`.

Prompt a envoyer :

```
Operation : archive
Slug : ${SLUG}
Repo root : ${REPO_ROOT}
Fichiers :
- ${FICHIER_1}
- ${FICHIER_2}
...
```

### Apres retour de l'agent

- Afficher le resume retourne par l'agent.
- Poser la question via `AskUserQuestion` : "Fichiers archives. Tu veux que je supprime les originaux du repo ?"
- Si **oui** → supprimer avec `trash` (JAMAIS `rm`)
- Si **non** → ne rien faire

---

## Sous-commande : `search`

**Execution directe dans le contexte principal — pas d'agent.**

### Etape 1 — Decouverte via Obsidian

Executer via Bash :

```bash
obsidian vault="gerber-vault" search format=json query="<QUERY>"
```

- Resultat : tableau JSON de chemins relatifs (ex. `["agent-brain/file.md", "caserne/file.md"]`)
- Filtrer : exclure toute entree dont le `basename` est `INDEX.md`
- Si la liste filtree est vide → passer a l'**Etape 2-bis** (Grep global)

### Etape 2-bis — Fallback : Grep global (si Obsidian n'a rien retourne)

Si l'etape 1 a retourne une liste vide :

- Utiliser l'outil `Grep` sur `~/.config/gerber-vault/` avec la query fournie et `-C 2`
- Exclure `.git/` et les fichiers `INDEX.md`
- Si toujours aucun resultat → afficher "Aucun resultat pour `${QUERY}` dans le vault." et STOPPER
- Sinon : passer directement a l'etape 3 avec ces resultats (pas d'etape 2 normale)

### Etape 2 — Extraction du contexte via Grep

Pour chaque fichier retenu :

- Construire le chemin absolu : `~/.config/gerber-vault/<chemin_relatif>`
- Lancer `Grep` avec la query originale et `-C 2` sur ce fichier specifique
- Si Grep ne retourne aucune correspondance dans ce fichier : afficher uniquement le chemin, sans extrait

### Etape 3 — Affichage groupe par projet

- Grouper les resultats par **premier composant** du chemin relatif (ex. `agent-brain`, `caserne`)
- Afficher pour chaque groupe : nom du projet en titre, puis chaque fichier avec ses extraits (ou juste le chemin si pas d'extrait)

---

## Sous-commande : `status`

**Execution directe dans le contexte principal — pas d'agent.**

1. Lire le fichier `~/.config/gerber-vault/INDEX.md` avec l'outil `Read`.
2. Si le fichier est absent → afficher "Vault vide ou non initialise. Lance `/gerber:vault index` pour generer l'index."
3. Afficher le contenu de l'index global.

---

## Sous-commande : `index`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: true` et `mode: "bypassPermissions"`.

Afficher au lancement : `Indexation du vault lancee en background...`

Prompt a envoyer :

```
Operation : index
```

### Apres retour de l'agent

Afficher le resume retourne par l'agent.

---

## Sous-commande : `clean`

### Delegation a l'agent

Lancer l'agent `gerber:agent-vault` via l'outil `Agent` avec `subagent_type: "gerber:agent-vault"`, `run_in_background: false` et `mode: "bypassPermissions"`.

Pourquoi pas en background : l'agent doit poser une question de confirmation a l'utilisateur via `AskUserQuestion`. Le mode background empecherait cette interaction.

Prompt a envoyer :

```
Operation : clean
```

### Apres retour de l'agent

Afficher le resume retourne par l'agent.

---

## Contraintes absolues

- Ne JAMAIS supprimer des fichiers du vault sans confirmation explicite de l'utilisateur
- Utiliser `trash` pour toutes les suppressions — JAMAIS `rm`, `rmdir`, ou `unlink`
- Ce skill s'execute dans le **contexte principal** : les instructions s'adressent a Claude directement, pas a un sous-agent
- Les sous-commandes `search` et `status` ne deleguent jamais a un agent
