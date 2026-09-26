# Validation des évolutions

Mesures du 27 septembre 2026, Linux, Node v24.14.0, AMD Ryzen 5 2600 Six-Core Processor.
Une chauffe puis dix mesures ; p95 = maximum de ces dix mesures.
Carte de 128 × 128 cellules, dessin de 256 × 256 pixels / 1024 tiles ; archive de 50835 octets.

| Opération               | Médiane (ms) | p95 (ms) |
| ----------------------- | -----------: | -------: |
| save 16,384 cells       |        60.07 |    65.97 |
| load 16,384 cells       |        24.07 |    33.01 |
| render 1024x1024 pixels |       210.36 |   220.32 |
| object load 120 frames  |         3.11 |     4.09 |

Mesures du cœur sous Node, pas de latence de saisie ni de rendu React. Le rendu intégral d’une grande carte coûte environ 210 ms ; ce chiffre ne permet pas de promettre 60 images/s. Aucun cache spéculatif ajouté. Relancer `npm run benchmark` pour comparer sur une autre machine.

## Parcours vérifiés

- Navigateur Chrome Linux : nouvelles interfaces des lots 1 à 7 parcourues et captures FR/EN 18–24 réalisées. Réimport de la tile 5, validation puis Undo : retour à l’état sans modification.
- Build web TypeScript/Vite réussi ; 46 tests passent.
- Exemples ca65 assemblés. Mesen 2.2.1 : décor observé, deux positions d’animation distinctes, palette modifiée à la pression de B, maintenue au relâchement, restaurée à la seconde pression. Captures dans artifacts/integration.

- Application native Linux : build release réussi, ouverture de Football, terrain 16 × 8 → 24 × 8 par ajout de colonne, Undo → 16 × 8. Capture `artifacts/native-linux.png`. Les dialogues d’enregistrement/réouverture ne sont pas validés par ce parcours.

## Parcours natifs à reproduire

Sous Linux et Windows : ouvrir une copie d’un projet, modifier une tile, enregistrer sous un nouveau nom, fermer/rouvrir et comparer ; redimensionner puis Undo ; réimporter et vérifier les usages ; exporter et ouvrir la ROM dans Mesen. Sous Windows, vérifier également les chemins avec espaces et caractères accentués. Aucun poste Windows n’est accessible dans cette session : validation Windows non réalisée.
