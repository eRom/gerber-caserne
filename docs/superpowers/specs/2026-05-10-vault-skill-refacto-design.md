# Vault skill — refacto réindex auto + push fiable

**Date** : 2026-05-10
**Statut** : Design approved
**Plugin** : gerber (1.4.0 → 1.5.0)
**Fichiers cibles** : `agents/agent-vault.md`, `skills/vault/SKILL.md`

## Contexte

La skill `/gerber:vault` archive des fichiers de projets divers vers un repo git local (`~/.config/gerber-vault/`), poussé sur GitHub. Plusieurs frictions ont été observées :

1. **Index figé** : l'`INDEX.md` projet déduplique par chemin → la date et la description figées au premier archivage, jamais rafraîchies aux passages suivants.
2. **Dossiers fantômes** : si `archive` est lancé avec une liste de fichiers vide, l'agent crée le dossier projet (`mkdir -p`) sans rien copier. Git ignore les dossiers vides → ils ne sont ni commités ni poussés. Résultat : 17 dossiers projet en local, 1 seul (`agent-brain/`) sur GitHub.
3. **Erreurs push masquées** : la commande shell `git remote get-url origin && git push || echo "NO_REMOTE"` confond "pas de remote" et "push échoué" sous le même label trompeur.
4. **"Nothing to commit" remonté comme FAIL** : le `git commit` final affiche `FAIL` alors que le no-op est un cas attendu (re-archive de fichiers déjà à jour).

## Objectifs

- L'`INDEX.md` projet reflète l'état réel du contenu archivé à chaque exécution.
- Aucun dossier vide n'est créé ni laissé en place après une opération.
- Les erreurs réelles du push sont remontées clairement, distinguées de "pas de remote".
- Une re-archive idempotente (mêmes fichiers, mêmes contenus) ne produit pas de FAIL parasite.

## Architecture

Trois sous-routines partagées sont introduites dans `agent-vault.md`, et toutes les opérations sont réécrites pour les utiliser.

| Routine | Rôle | Appelée par |
|---|---|---|
| `regenIndexProjet(slug)` | Scan `~/.config/gerber-vault/<slug>/` (hors `INDEX.md`), reconstruit le tableau Markdown depuis zéro. Date = mtime du fichier. Description = première ligne non vide (tronquée 80 chars). Écrit dans `<slug>/INDEX.md`. | `archive` (après copie), `index` (boucle) |
| `regenIndexGlobal()` | Scan `~/.config/gerber-vault/*/`, compte les fichiers (hors `INDEX.md`), lit la mtime de chaque `<slug>/INDEX.md`. Écrit `INDEX.md` racine. | `archive`, `index`, `clean` |
| `commitAndPush(message)` | `git add -A` ; détecte "nothing to commit" comme cas OK ; commit ; push avec gestion fine des erreurs (4 états : remote absent, rien à push, push OK, push FAIL avec erreur réelle). | `archive`, `index`, `clean` |

Une nouvelle sous-commande `clean` est ajoutée pour gérer les dossiers fantômes existants.

## Comportement détaillé

### `archive <fichiers...>`

```
1. Pré-vol vault : vérifier ~/.config/gerber-vault/.git existe, sinon STOP.
2. Résoudre slug + REPO_ROOT (inchangé).
3. Résoudre liste fichiers absolus.
4. SI liste vide → afficher "Aucun fichier à archiver pour <slug>." + STOP.
   (Pas de mkdir, pas de commit, pas de dossier fantôme.)
5. mkdir -p ~/.config/gerber-vault/<slug>/
6. Pour chaque fichier : calculer relpath depuis REPO_ROOT, mkdir -p sous-dossiers, cp.
7. regenIndexProjet(slug)
8. regenIndexGlobal()
9. commitAndPush("archive(<slug>): +N fichier(s)")
10. Résumé : N copiés / commit OK ou no-op / push OK ou erreur réelle.
```

**Disparu** : l'étape "dédup par chemin" qui figeait les dates. La nouvelle étape 7 est idempotente.

### `index`

Comportement inchangé en surface, refactor interne.

```
1. Pré-vol vault.
2. Pour chaque dossier projet : regenIndexProjet(slug).
3. regenIndexGlobal().
4. commitAndPush("index: regeneration complete")
5. Résumé.
```

### `clean` (nouvelle sous-commande)

```
1. Pré-vol vault.
2. Lister les dossiers projet vides : find ~/.config/gerber-vault -mindepth 1 -maxdepth 1 -type d -empty -not -name '.*'
3. Si zéro → "Aucun dossier vide à nettoyer." + STOP.
4. Sinon → AskUserQuestion : "X dossiers vides détectés (liste). Supprimer ?"
5. Si oui : rmdir <chaque dossier> ; regenIndexGlobal() ; commitAndPush("clean: removed N empty project folder(s)").
6. Résumé.
```

### `search` et `status`

Inchangés. Pas de logique git, restent en exécution directe dans le contexte principal.

## Format des commit messages

| Opération | Format |
|---|---|
| `archive` | `archive(<slug>): +N fichier(s)` |
| `index` (global) | `index: regeneration complete` |
| `clean` | `clean: removed N empty project folder(s)` |

Pas de slug pour `index` et `clean` : opérations multi-projets, le slug n'a pas de sens.

## Sous-routine `commitAndPush(message)` — pseudo-code

```bash
cd ~/.config/gerber-vault
git add -A

# Cas 1 : rien à commit → c'est OK, pas une erreur
if git diff --cached --quiet; then
  COMMIT_RESULT="no-op"
else
  if git commit -m "<message>"; then
    COMMIT_RESULT="OK"
  else
    COMMIT_RESULT="FAIL"
  fi
fi

# Push : 4 états distincts
if ! git remote get-url origin >/dev/null 2>&1; then
  PUSH_RESULT="skipped (no remote)"
elif [ "$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)" = "0" ]; then
  PUSH_RESULT="skipped (nothing to push)"
else
  if PUSH_OUTPUT=$(git push 2>&1); then
    PUSH_RESULT="OK"
  else
    PUSH_RESULT="FAIL: $PUSH_OUTPUT"
  fi
fi
```

## Format du résumé final

```
Archive terminée -- agent-brain
-------------------------------
Copiés   : 5 fichier(s)
Index    : régénéré (projet + global)
Commit   : OK
Push     : OK
```

En cas d'erreur de push :
```
Push     : FAIL — error: failed to push some refs to 'origin' (rebase needed)
```

## Cas limites couverts

| Cas | Comportement |
|---|---|
| `archive` avec 0 fichier résolu | STOP avant `mkdir`. Pas de dossier fantôme. |
| `archive` avec dossier source vide | Idem (résolution → 0 fichier). |
| Re-archive du même fichier inchangé | `cp` idempotent → index identique → `git diff --cached` vide → commit `no-op` propre. |
| Re-archive d'un fichier modifié | `cp` écrase, mtime change, index recalculé, commit + push normaux. |
| Modifs Obsidian non commit (`.obsidian/*`) | `git add -A` les attrape à la prochaine opération vault. Le commit message porte celui de l'opération en cours (acceptable). |
| Push rejected (besoin rebase) | Erreur réelle remontée. Pas de retry auto. |
| Push : pas de remote configuré | `skipped (no remote)`. |
| Repo vault non initialisé | Pré-vol étape 0 : message + STOP. |
| `clean` sans dossier vide | "Aucun dossier vide" + STOP, pas de commit. |
| `clean` annulé par utilisateur | Aucune modif, aucun commit. |

## Hors scope

- Pré-commit hook synchronisant les modifs Obsidian séparément.
- Mode `archive --force-reindex` (l'archive ré-indexe déjà à chaque passage).
- Nettoyage auto au boot du vault (laisse `clean` explicite, plus prudent).
- Concurrence : ne pas lancer deux opérations vault en parallèle (à documenter dans la skill).

## Checklist d'implémentation

1. Refactor `agents/agent-vault.md` :
   - Définir les 3 sous-routines (`regenIndexProjet`, `regenIndexGlobal`, `commitAndPush`) en pseudo-code.
   - Réécrire `archive`, `index` pour les utiliser.
   - Ajouter `clean`.
2. Mettre à jour `skills/vault/SKILL.md` :
   - Ajouter `clean` au tableau des sous-commandes.
   - Mettre à jour le pré-vol fichiers vides dans `archive`.
   - Mettre à jour le format du résumé final.
3. Bump version plugin gerber : `plugin.json` → 1.5.0 (mineur, ajout sous-commande + comportements).
4. Republier le plugin.
5. Test manuel en local sur `agent-brain` avant publish.
