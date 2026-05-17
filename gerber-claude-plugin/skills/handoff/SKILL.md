---
name: handoff
description: "Transfère le contexte d'une session Claude entre environnements (CLI, Desktop, claude.ai, iOS) via Linear (workspace eRom, projet Handoffs). Déclenche dès que l'utilisateur veut commencer, lister, reprendre ou libérer un transfert — ou toute intention de basculer vers une autre plateforme Claude (ex : 'commence un transfert', 'liste mes transferts', 'prends le transfert X', 'libère le transfert X', 'passe la main', 'reprends là où j'en étais ailleurs'). Marche partout où le plugin Linear MCP est connecté — y compris mobile."
user-invocable: true
---

# handoff — Passage de témoin entre sessions Claude

Cette skill remplace les trous du `/teleport` natif (Cowork → Code, Claude.ai → Cowork, Mobile → CLI avec uncommit…) par un coffre portable côté **Linear** : un handoff est une note courte, créée dans une session, récupérée dans une autre.

Un handoff vit comme une **issue Linear** dans le projet `Handoffs` (team `eRom-Agents`), avec le label `handoff`. Il n'est associé à aucun projet métier — il circule librement.

## Container Linear (immutable)

Tous les handoffs utilisent ces paramètres. **Ne jamais en dévier.**

| Paramètre | Valeur |
|---|---|
| `team` | `eRom-Agents` |
| `project` | `Handoffs` |
| `labels` | `["handoff"]` |
| État initial | `Todo` (= "inbox" gerber historique) |
| État final | `Done` (= "done" gerber historique) |

## Résolution de l'action

L'utilisateur ne tape pas forcément une commande structurée — il parle. Mappe l'intention :

| Intention utilisateur | Action | Tool MCP |
|---|---|---|
| « commence un transfert », « nouveau transfert », « save ça », « passe la main » | Créer | `mcp__plugin_linear_linear__save_issue` |
| « liste mes transferts », « mes handoffs », « qu'est-ce qui m'attend » | Lister | `mcp__plugin_linear_linear__list_issues` |
| « prends le transfert X », « reprends X », « charge le transfert X » | Récupérer | `mcp__plugin_linear_linear__get_issue` (ou `list_issues` par titre) |
| « libère le transfert X », « supprime le transfert X », « marque X done » | Fermer | `mcp__plugin_linear_linear__save_issue` (state: Done) |

En cas d'ambiguïté, pose une question fermée (« Tu veux que je crée un nouveau transfert ou que je reprenne un existant ? ») — ne devine pas à l'aveugle.

## Étape 1 — Créer un transfert

Quand l'utilisateur veut laisser un passage de témoin à sa session future :

1. **Compose un titre court** (3–6 mots), descriptif du sujet principal en cours. Pas de ponctuation finale.
   - Exemples : `Brainstorm dashboard v3`, `Spec OAuth connector`, `Bug E5 chunking`.

2. **Compose le contenu** (markdown) à partir du contexte de la conversation. **Pas de template imposé** — adapte-toi à la nature de l'échange (idéation, spec, question ouverte, debug…). Vise un contenu suffisant pour qu'une session fraîche reprenne sans te poser de question bête. Les éléments qui *peuvent* être utiles selon le cas :
   - ce qu'on vient de faire / de décider
   - la prochaine action concrète
   - les fichiers touchés et leur statut git (si pertinent)
   - les blockers, questions ouvertes, options encore sur la table

3. **Confirme** le draft avant d'écrire :
   ```
   --- Transfert ---
   Titre : <title>

   <content>
   -----------------
   Créer ce transfert ? (o/n)
   ```

4. Sur `o`, appelle :
   ```
   mcp__plugin_linear_linear__save_issue({
     team: "eRom-Agents",
     project: "Handoffs",
     title: <title>,
     description: <content>,
     labels: ["handoff"],
     state: "Todo"
   })
   ```

5. Confirme avec l'identifier Linear (parlant) et l'URL :
   ```
   Transfert créé : "<title>" → EAT-XXX
   https://linear.app/erom/issue/EAT-XXX
   ```

## Étape 2 — Lister les transferts

Par défaut, ne montre que les transferts actifs (état `Todo`). Appelle :

```
mcp__plugin_linear_linear__list_issues({
  project: "Handoffs",
  state: "Todo",
  orderBy: "createdAt"
})
```

Si l'utilisateur demande explicitement « tous » : ne passe pas `state`. S'il demande « les transferts finis » : `state: "Done"`.

Affichage (toujours montrer l'identifier `EAT-XXX` — c'est ce que l'utilisateur tapera ensuite) :
```
=== Transferts (3 Todo) ===

1. [EAT-170] Brainstorm dashboard v3      2h ago
2. [EAT-165] Spec OAuth connector         hier
3. [EAT-158] Bug E5 chunking              3j ago
```

Si vide :
```
=== Transferts (0 Todo) ===
Rien en attente.
```

## Étape 3 — Reprendre un transfert

1. **Si l'utilisateur a fourni un identifier `EAT-XXX`** (cas le plus courant) :
   ```
   mcp__plugin_linear_linear__get_issue({ id: "EAT-XXX" })
   ```

2. **Sinon, recherche par titre** :
   ```
   mcp__plugin_linear_linear__list_issues({
     project: "Handoffs",
     query: <title>,
     orderBy: "createdAt",
     limit: 5
   })
   ```
   - Prends le résultat le plus récent en cas de match exact unique.
   - Si plusieurs matches plausibles : affiche-les et demande lequel reprendre (par EAT-XXX).

3. Affiche le contenu complet, puis un **TL;DR 2 phrases max** de ce qui reste à faire :
   ```
   === [EAT-XXX] <title> ===
   <description>

   → Prochaine action : <ta reformulation concise>
   ```

4. Ne ferme pas automatiquement le transfert. Si l'utilisateur dit « c'est bon, je reprends », propose de le libérer maintenant (voir Étape 4).

## Étape 4 — Libérer un transfert

Quand l'utilisateur a terminé de reprendre le contexte ou veut nettoyer :

1. Appelle :
   ```
   mcp__plugin_linear_linear__save_issue({
     id: "EAT-XXX",
     state: "Done"
   })
   ```

2. Confirme : `Transfert "<title>" libéré (EAT-XXX → Done).`

Note : `Done` est un état de complétion. L'issue reste consultable (liste avec `state: "Done"` ou sans filtre). Pas de delete — l'historique est préservé.

## Résolution par titre — collisions

Si plusieurs transferts ont le même titre, `list_issues` les retourne triés par `createdAt`. Préfère :
- D'abord référencer par `EAT-XXX` quand l'utilisateur en a un.
- Sinon, prends le plus récent et mentionne explicitement la résolution (« J'ai pris EAT-170, le plus récent — il y en a aussi un de la semaine dernière (EAT-158) si c'était l'autre. »).

## Portabilité

Cette skill ne dépend **que** des tools MCP `mcp__plugin_linear_linear__*`. Aucun fichier local, aucun git, aucun path. Elle fonctionne donc identiquement depuis :

- Claude Code CLI (Mac / Linux)
- Claude Desktop (code + cowork)
- claude.ai (custom connector Linear OAuth)
- Claude iOS (custom connector Linear OAuth)

La seule condition : le plugin Linear MCP doit être listé dans la session courante.

## Contraintes

- Ne JAMAIS inventer de champ structuré non listé ci-dessus (priority, milestone, cycle, parentId, assignee…) : un handoff est volontairement minimal.
- Ne JAMAIS dévier du container (`team: eRom-Agents`, `project: Handoffs`, `labels: ["handoff"]`).
- Ne JAMAIS supprimer un transfert. Seule la transition `Todo → Done` est utilisée pour préserver l'historique.
- Toujours demander confirmation avant la création — le contenu est généré par l'agent, l'utilisateur doit pouvoir l'amender.
- Toujours afficher l'identifier `EAT-XXX` dans les confirmations et listings — c'est la handle parlante.
- Utiliser exclusivement les tools MCP `mcp__plugin_linear_linear__*` — jamais curl, jamais SQL, jamais de fichier.
