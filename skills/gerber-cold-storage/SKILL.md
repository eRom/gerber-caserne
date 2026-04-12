---
name: gerber-agent-notebook
description: "Cold storage de documents projet dans NotebookLM (Google). Sous-commandes : init, archive, status, query."
user-invocable: true
---

# gerber-agent-notebook

Cold storage de documents projet dans un notebook NotebookLM (Google).
Délègue l'exécution à l'agent `gerber-agent-notebook` (Haiku).

## Arguments

```
/gerber-agent-notebook <commande> [args...]
```

| Commande | Description |
|----------|-------------|
| `init` | Créer le notebook NotebookLM pour le projet courant |
| `archive <dossier \| fichier1 fichier2 ...>` | Ajouter des sources au notebook |
| `status` | Vérifier l'état du notebook et des sources indexées |
| `query <question>` | Interroger le notebook |

## Résolution du slug

Lire `.gerber-slug` à la racine du repo courant.
Si absent, lire le `CLAUDE.md` et chercher une section `## Gerber` contenant un slug.
Fallback : `basename "$PWD"`.

## Exécution

**Chaque sous-commande est déléguée à l'agent `gerber-agent-notebook`** via l'outil `Agent` avec `subagent_type: "gerber-agent-notebook"`.

Le prompt envoyé à l'agent contient UNIQUEMENT :
- L'opération à exécuter
- Les paramètres nécessaires (slug, notebook ID, fichiers, question)

L'agent connaît déjà les étapes — ne PAS répéter les instructions dans le prompt.

## Mode background

Par défaut, lancer l'agent en **background** (`run_in_background: true`).
Afficher au lancement : `Cold storage [commande] lancé en background...`

Exceptions — lancer en **foreground** (bloquant) :
- `init` : on a besoin du notebook ID retourné pour écrire `.gerber-nlm`
- `query` : seulement si l'utilisateur attend la réponse dans le flux de conversation

---

## Sous-commande : `init`

### Prompt à envoyer à l'agent

```
Operation : init
Slug : ${SLUG}
```

### Après retour de l'agent

- Si succès : sauvegarder le notebook ID dans le fichier `.gerber-nlm` à la racine du repo (contenu : uniquement l'UUID, une ligne).
- Vérifier que `.gerber-nlm` est dans le `.gitignore`. Si non, l'ajouter.

---

## Sous-commande : `archive`

### Pré-traitement (AVANT de lancer l'agent)

1. Lire `.gerber-nlm` à la racine du repo. Si absent → affiche "Notebook non initialisé. Lance `/gerber-agent-notebook init` d'abord." et STOPPE.
2. Résoudre la liste de fichiers :
   - Si l'argument est un **dossier** : lister tous les fichiers du dossier (non récursif)
   - Si les arguments sont des **fichiers** : utiliser la liste telle quelle
   - Filtrer : ne garder que les extensions `.md`, `.pdf`, `.txt`, `.html`, `.json`, `.csv`
   - Convertir tous les chemins en **chemins absolus**

### Prompt à envoyer à l'agent

```
Operation : archive
Notebook ID : ${NOTEBOOK_ID}
Fichiers :
- ${FICHIER_1}
- ${FICHIER_2}
...
```

---

## Sous-commande : `status`

### Pré-traitement

Lire `.gerber-nlm`. Si absent → STOPPE avec message.

### Prompt à envoyer à l'agent

```
Operation : status
Notebook ID : ${NOTEBOOK_ID}
Slug : ${SLUG}
```

---

## Sous-commande : `query`

### Pré-traitement

Lire `.gerber-nlm`. Si absent → STOPPE avec message.

### Prompt à envoyer à l'agent

```
Operation : query
Notebook ID : ${NOTEBOOK_ID}
Question : ${QUESTION}
```

---

## Contraintes absolues

- Ne JAMAIS supprimer un notebook ou une source sans confirmation explicite de l'utilisateur
- Le fichier `.gerber-nlm` contient uniquement l'UUID du notebook, rien d'autre
