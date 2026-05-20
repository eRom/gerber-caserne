---
name: handoff
description: "Transfère le contexte d'une session Claude entre environnements (CLI, Desktop, claude.ai, iOS) via Linear (workspace eRom, projet Handoffs). Déclenche dès que l'utilisateur veut commencer, lister, reprendre ou libérer un transfert — ou toute intention de basculer vers une autre plateforme Claude ('commence un transfert', 'liste mes transferts', 'prends le transfert X', 'passe la main', 'reprends là où j'en étais ailleurs')."
user-invocable: true
---

# handoff

Un handoff = une issue Linear dans le projet `Handoffs` (team `eRom-Agents`), label `handoff`.

## Container (immuable)

`team: "eRom-Agents"` · `project: "Handoffs"` · `labels: ["handoff"]` · état initial `Todo`, état final `Done`.

## Résolution de l'intention

| Intention | Action | Tool |
|---|---|---|
| « commence un transfert », « save ça », « passe la main » | Créer | `save_issue` |
| « liste mes transferts », « mes handoffs » | Lister | `list_issues` |
| « prends/reprends/charge le transfert X » | Récupérer | `get_issue` (ou `list_issues` par titre) |
| « libère/supprime/done le transfert X » | Fermer | `save_issue` (state: Done) |

Ambiguïté → question fermée, ne pas deviner.

## Créer

1. Titre court (3–6 mots), pas de ponctuation finale.
2. Contenu markdown adapté à la nature de l'échange. Pas de template imposé. Vise suffisant pour qu'une session fraîche reprenne sans question bête. Éléments potentiellement utiles : ce qu'on vient de décider, prochaine action, fichiers touchés + statut git, blockers, questions ouvertes.
3. Confirmer le draft :
   ```
   --- Transfert ---
   Titre : <title>

   <content>
   -----------------
   Créer ? (o/n)
   ```
4. Sur `o` :
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
5. Confirmer : `Transfert créé : "<title>" → EAT-XXX` + URL.

## Lister

```
mcp__plugin_linear_linear__list_issues({
  project: "Handoffs",
  state: "Todo",
  orderBy: "createdAt"
})
```

Par défaut `state: "Todo"`. Si l'utilisateur demande « tous » → omettre `state`. « les finis » → `state: "Done"`.

Affichage (toujours montrer l'identifier `EAT-XXX`) :
```
=== Transferts (3 Todo) ===

1. [EAT-170] Brainstorm dashboard v3      2h ago
2. [EAT-165] Spec OAuth connector         hier
3. [EAT-158] Bug E5 chunking              3j ago
```

Vide : `=== Transferts (0 Todo) ===\nRien en attente.`

## Reprendre

- Si identifier fourni : `get_issue({ id: "EAT-XXX" })`.
- Sinon recherche par titre : `list_issues({ project: "Handoffs", query: <title>, limit: 5 })`.
  - Match unique → l'utiliser.
  - Plusieurs matches → afficher et demander lequel.

Affichage :
```
=== [EAT-XXX] <title> ===
<description>

→ Prochaine action : <ta reformulation concise en ≤2 phrases>
```

Ne ferme PAS automatiquement. Si l'utilisateur dit « c'est bon, je reprends », proposer de libérer.

## Libérer

```
mcp__plugin_linear_linear__save_issue({ id: "EAT-XXX", state: "Done" })
```

Confirmer : `Transfert "<title>" libéré (EAT-XXX → Done).`

## Contraintes

- Ne JAMAIS ajouter de champ structuré au-delà de title/description/labels/state (pas de priority, milestone, cycle, parentId, assignee). Un handoff est volontairement minimal.
- Ne JAMAIS dévier du container (team/project/labels).
- Ne JAMAIS supprimer un transfert (uniquement `Todo → Done`, l'historique est préservé).
- Toujours confirmer avant création.
- Toujours afficher `EAT-XXX` dans confirmations et listings.
