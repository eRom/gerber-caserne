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
| `index` | Regenerer l'index du vault |

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
3. **Obtenir la racine du repo** : executer `git rev-parse --show-toplevel` depuis le dossier courant. Si echec (pas un repo git), utiliser `$PWD`.
4. **Verifier le vault** : s'assurer que `~/.config/gerber-vault/.git` existe. Si non → afficher "Vault non initialise. Le dossier `~/.config/gerber-vault/` doit etre un repo git." et STOPPER.
5. Afficher : `Archivage lance en background...`

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

1. Utiliser l'outil `Grep` sur `~/.config/gerber-vault/` avec la query fournie, en incluant des lignes de contexte (`-C 2`).
2. Filtrer les resultats : exclure les fichiers `INDEX.md` et tout ce qui est dans `.git/`.
3. Grouper les resultats par projet (premier niveau de repertoire dans `~/.config/gerber-vault/`).
4. Afficher les resultats groupes avec le chemin de chaque fichier et les lignes correspondantes.

Si aucun resultat → afficher "Aucun resultat pour `${QUERY}` dans le vault."

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

## Contraintes absolues

- Ne JAMAIS supprimer des fichiers du vault sans confirmation explicite de l'utilisateur
- Utiliser `trash` pour toutes les suppressions — JAMAIS `rm`, `rmdir`, ou `unlink`
- Ce skill s'execute dans le **contexte principal** : les instructions s'adressent a Claude directement, pas a un sous-agent
- Les sous-commandes `search` et `status` ne deleguent jamais a un agent
