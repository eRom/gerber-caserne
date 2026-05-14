---
name: handoff
description: "Transfère le contexte d'une session Claude entre environnements (CLI, Desktop, claude.ai, iOS) via le coffre handoff de gerber MCP. Déclenche dès que l'utilisateur veut commencer, lister, reprendre ou libérer un transfert — ou toute intention de basculer vers une autre plateforme Claude (ex : 'commence un transfert', 'liste mes transferts', 'prends le transfert X', 'libère le transfert X', 'passe la main', 'reprends là où j'en étais ailleurs'). Marche partout où le MCP gerber est connecté — y compris mobile."
user-invocable: true
---

# handoff — Passage de témoin entre sessions Claude

Cette skill remplace les trous du `/teleport` natif (Cowork → Code, Claude.ai → Cowork, Mobile → CLI avec uncommit…) par un coffre portable côté gerber : un handoff est une note courte, créée dans une session, récupérée dans une autre.

Un handoff n'est **pas** associé à un projet. Il vit dans sa propre table et circule librement.

## Résolution de l'action

L'utilisateur ne tape pas forcément une commande structurée — il parle. Mappe l'intention :

| Intention utilisateur | Action | Tool MCP |
|---|---|---|
| « commence un transfert », « nouveau transfert », « save ça », « passe la main » | Créer | `mcp__gerber__handoff_create` |
| « liste mes transferts », « mes handoffs », « qu'est-ce qui m'attend » | Lister | `mcp__gerber__handoff_list` |
| « prends le transfert X », « reprends X », « charge le transfert X » | Récupérer | `mcp__gerber__handoff_get` |
| « libère le transfert X », « supprime le transfert X », « marque X done » | Fermer | `mcp__gerber__handoff_close` |

En cas d'ambiguïté, pose une question fermée (« Tu veux que je crée un nouveau transfert ou que je reprenne un existant ? ») — ne devine pas à l'aveugle.

## Étape 1 — Créer un transfert

Quand l'utilisateur veut laisser un passage de témoin à sa session future :

1. **Compose un titre court** (3–6 mots), descriptif du sujet principal en cours. Pas de ponctuation finale.
   - Exemples : `Brainstorm dashboard v3`, `Spec OAuth connector`, `Bug E5 chunking`.

2. **Compose le contenu** à partir du contexte de la conversation. **Pas de template imposé** — adapte-toi à la nature de l'échange (idéation, spec, question ouverte, debug…). Vise un contenu suffisant pour qu'une session fraîche reprenne sans te poser de question bête. Les éléments qui *peuvent* être utiles selon le cas :
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

4. Sur `o`, appelle `mcp__gerber__handoff_create` avec `{ title, content }`. `status` par défaut = `inbox`.

5. Confirme : `Transfert créé : "<title>" (<uuid court>)`.

## Étape 2 — Lister les transferts

Par défaut, ne montre que les transferts actifs (`status = inbox`). Appelle `mcp__gerber__handoff_list` avec `{ status: "inbox" }`.

Si l'utilisateur demande explicitement « tous » ou « les transferts finis », appelle sans filtre ou avec `status: "done"`.

Affichage :
```
=== Transferts (3 inbox) ===

1. Brainstorm dashboard v3        2h ago
2. Spec OAuth connector           hier
3. Bug E5 chunking                3j ago
```

Si vide :
```
=== Transferts (0 inbox) ===
Rien en attente.
```

## Étape 3 — Reprendre un transfert

1. Appelle `mcp__gerber__handoff_get` :
   - avec `{ id }` si l'utilisateur a fourni un UUID
   - sinon avec `{ title }` (le serveur prend le plus récent en cas de collision)

2. Affiche le contenu complet, puis un **TL;DR 2 phrases max** de ce qui reste à faire :
   ```
   === <title> ===
   <content>

   → Prochaine action : <ta reformulation concise>
   ```

3. Ne ferme pas automatiquement le transfert. Si l'utilisateur dit « c'est bon, je reprends », propose de le libérer maintenant (voir Étape 4).

## Étape 4 — Libérer un transfert

Quand l'utilisateur a terminé de reprendre le contexte ou veut nettoyer :

1. Appelle `mcp__gerber__handoff_close` avec `{ id }` ou `{ title }`.
2. Confirme : `Transfert "<title>" libéré.`

Note : `close` passe le statut à `done`, ça ne supprime pas la ligne. L'historique reste consultable via `handoff_list` sans filtre.

## Résolution par titre — collisions

Si plusieurs transferts ont exactement le même titre, le serveur retourne **le plus récent** et loggue un warning. Quand c'est possible, préfère référencer par UUID (la liste en expose toujours un court). En cas de doute, liste d'abord puis demande lequel.

## Portabilité

Cette skill ne dépend **que** des 4 tools MCP `mcp__gerber__handoff_*`. Aucun fichier local, aucun git, aucun path. Elle fonctionne donc identiquement depuis :

- Claude Code CLI (Mac / Linux)
- Claude Desktop (code + cowork)
- claude.ai (custom connector OAuth)
- Claude iOS (custom connector OAuth)

La seule condition : le serveur gerber MCP doit être listé dans la session courante.

## Contraintes

- Ne JAMAIS inventer de champ structuré (priority, tags, projectId…) : la table n'en a pas, le tool n'en attend pas.
- Ne JAMAIS supprimer un transfert (pas de delete). Seul le `close` existe pour préserver l'historique.
- Toujours demander confirmation avant `handoff_create` — le contenu est généré par l'agent, l'utilisateur doit pouvoir l'amender.
- Utiliser exclusivement les outils MCP `mcp__gerber__handoff_*` — jamais curl, jamais SQL, jamais de fichier.
