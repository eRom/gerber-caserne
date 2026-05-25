---
name: handoff
description: "Cree, liste, reprend ou libere un transfert de session via Linear, projet Handoffs. Use when l'utilisateur dit handoff, transfert, passe la main, reprends un transfert, ou /gerber:handoff."
user-invocable: true
---

# handoff

Un handoff est une issue Linear dans le projet `Handoffs`, team `eRom-Agents`, label `handoff`.

## Container

- Team : `eRom-Agents`
- Project : `Handoffs`
- Label : `handoff`
- Etat initial : `Todo`
- Etat final : `Done`

## Intentions

| Intention | Action |
|---|---|
| commence un transfert, save ca, passe la main | Creer |
| liste mes transferts, mes handoffs | Lister |
| prends/reprends/charge le transfert X | Recuperer |
| libere/done le transfert X | Fermer |

Ambiguite : poser une question fermee, ne pas deviner.

## Creer

1. Titre court, 3 a 6 mots, sans ponctuation finale.
2. Description markdown suffisante pour une session fraiche : decisions, prochaine action, fichiers touches, statut git, blockers, questions ouvertes.
3. Confirmer :

```text
--- Transfert ---
Titre : <title>

<content>
-----------------
Creer ? (o/n)
```

4. Sur `o`, utiliser le MCP Linear deja installe pour creer l'issue :
   - team `eRom-Agents`
   - project `Handoffs`
   - title
   - description
   - labels `["handoff"]`
   - state `Todo`
5. Confirmer : `Transfert cree : "<title>" -> EAT-XXX` avec URL.

## Lister

Par defaut, lister les issues Linear `Todo` du projet `Handoffs`, ordre creation.
Si l'utilisateur demande `tous`, omettre le filtre state. Si `finis`, filtrer `Done`.

```text
=== Transferts (3 Todo) ===

1. [EAT-170] Brainstorm dashboard v3      2h ago
2. [EAT-165] Spec OAuth connector         hier
3. [EAT-158] Bug E5 chunking              3j ago
```

Vide : `=== Transferts (0 Todo) ===\nRien en attente.`

## Reprendre

- Si identifier fourni, recuperer l'issue.
- Sinon chercher par titre, afficher les matches et demander si plusieurs.

Affichage :

```text
=== [EAT-XXX] <title> ===
<description>

-> Prochaine action : <reformulation concise en 2 phrases max>
```

Ne ferme pas automatiquement. Proposer de liberer seulement si l'utilisateur indique qu'il reprend.

## Liberer

Mettre l'issue Linear a `Done`.

Confirmer : `Transfert "<title>" libere (EAT-XXX -> Done).`

## Contraintes

- Ne jamais supprimer un transfert.
- Toujours confirmer avant creation.
- Toujours afficher l'identifier `EAT-XXX`.
- Ne pas ajouter de champs hors title/description/labels/state.
