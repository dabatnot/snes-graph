# Formats SNES Graph, version 1

## Projet `.snesgraph`

Archive ZIP autonome, sans chemin source requis pour rouvrir le projet :

```text
project.json
pixels/<sheet-id>.bin
layers/<sheet-id>/<layer-id>.bin  # si le dessin possède des calques
```

`project.json` porte `format: "snes-graph"`, `version: 1`, le nom, la fréquence 50/60 Hz et les listes de palettes, dessins, personnages, cartes, scènes et ensembles d'export. Les références utilisent les identifiants. Une version inconnue est refusée.

Les pixels sont des indices d'un octet, rangés ligne par ligne, sans compression planaire à l'intérieur des fichiers `.bin`. Le dessin conserve une image aplatie et, éventuellement, ses calques artistiques. L'ordre des calques va du fond vers l'avant ; l'indice 0 laisse apparaître le calque inférieur. Leurs pixels et leur visibilité sont conservés dans l'archive.

Une palette contient 4, 16 ou 256 mots RGB555 `rrrrr | ggggg << 5 | bbbbb << 10`, des noms d'entrées et des verrous. Ces verrous protègent l'édition ; ils ne sont pas une affectation fixe à CGRAM. Les variantes associent des identifiants de palettes de base à des identifiants de remplacement.

Les fichiers importés sont vérifiés avant leur ouverture. La limite est de 128 Mio décompressés et 10 000 entrées. Les sauvegardes natives passent par un fichier temporaire sur le même volume, synchronisé puis renommé. La récupération automatique utilise le répertoire de données de l'application, ou IndexedDB dans le navigateur.

## Export générique

Tous les nombres multioctets binaires sont en **little-endian**. Les noms et les identifiants sont disponibles dans `manifest.json`. Les adresses de l'API de placement sont précisées ci-dessous pour éviter une confusion octets/mots.

Les dépendances des ressources sélectionnées doivent être cochées dans l'ensemble d'export, y compris les palettes des variantes. Une dépendance absente produit une erreur qui la nomme. L'ordre des palettes dans le manifeste correspond à l'ordre des indices logiques dans les métasprites. Le placement CGRAM tient compte des cycles complets de palettes et des cellules de carte hors caméra pour rester stable pendant la lecture.

| Fichier                           | Contenu                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `palettes/<id>.pal`               | Mots RGB555, entrée 0 comprise.                                                                                              |
| `tiles/<id>.chr`                  | Tiles 8 × 8 en format planaire SNES, 16/32/64 octets par tile en 2/4/8 bpp.                                                  |
| `maps/<id>.map`                   | Mots de tilemap en blocs de 32 × 32, blocs rangés de gauche à droite puis de haut en bas.                                    |
| `maps/<id>.collision`             | Un octet par cellule, ordre linéaire ligne par ligne. Interprétation libre pour le jeu.                                      |
| `sprites.chr`                     | Tiles OBJ 4 bpp placées sur deux pages de 16 × 16 tiles ; une pièce multituile utilise un pas de 16 tiles entre ses rangées. |
| `actors/<actor>/<pose>.meta`      | Pièces du métasprite, coordonnées relatives à l'origine.                                                                     |
| `actors/<actor>/<animation>.anim` | Séquence et durées en images console.                                                                                        |
| `assets.inc`                      | Constantes ca65 de taille et slots de palettes de la scène.                                                                  |
| `manifest.json`                   | Noms, références, poses, variantes, animations, événements, boîtes, attaches, réglages et affectations.                      |

Un mot de tilemap contient : index de tile sur 10 bits, palette sur 3 bits, priorité sur 1 bit et miroirs horizontal/vertical sur les bits 14/15. Les cartes génériques ont leur propre liste de palettes dans le manifeste. **Le placement commun des palettes entre plusieurs BG est celui de `scene/vram.bin`, pas celui des cartes exportées séparément.**

Pour une grande carte, les blocs génériques sont les unités disponibles pour le chargement. La mémoire initiale de la scène contient une fenêtre de 32 ou 64 cellules par axe. Le jeu reste responsable du défilement et du chargement progressif.

La déduplication transforme uniquement les fichiers exportés et leurs références. Elle ne fusionne pas les dessins éditables. En haute résolution, les tiles vont par paires consécutives : la déduplication est refusée afin de préserver cette relation.

### Correspondance des tiles après optimisation

`manifest.sheets[*].refs` contient une entrée par tile du dessin source, dans l’ordre ligne par ligne. `refs[sourceTile]` donne `{tile, flipX, flipY}` : l’index dans `tiles/<sheet-id>.chr` et les miroirs nécessaires pour retrouver les pixels source. Cette correspondance inclut les tiles réservées et la déduplication. Pour une cellule de tampon, combiner ses miroirs avec ceux de la référence par XOR.

Les `stamps[*].cells[*].tile`, `animatedTiles[*].tile` et `animatedTiles[*].frames` du manifeste restent des **indices source**. Chaque animation fournit aussi `cellIndices`, les positions des cellules de la carte qui utilisaient sa tile source, calculées par `y * largeur + x` avant optimisation. Cela distingue une occurrence animée d’une tile statique identique fusionnée dans le CHR. Ces positions sont celles de la carte source, pas des offsets dans les blocs binaires de 32 × 32.

La mémoire de scène applique les animations de tiles au tick demandé, y compris en Mode 7. Une frame Mode 7 nécessitant un miroir de tile est refusée : désactiver la réutilisation des miroirs pour ce mode.

### Métasprite `.meta`

En-tête : `u16 nombreDePièces`. Puis **10 octets par pièce**, dans l'ordre OAM :

| Position | Type | Donnée                                                      |
| -------- | ---- | ----------------------------------------------------------- |
| 0        | i16  | X relatif à l'origine                                       |
| 2        | i16  | Y relatif à l'origine                                       |
| 4        | u16  | Index de tile OBJ 0…511                                     |
| 6        | u16  | Index logique de palette dans la liste du manifeste         |
| 8        | u8   | Priorité aux bits 4–5, miroir X au bit 6, miroir Y au bit 7 |
| 9        | u8   | Taille carrée en pixels : 8, 16, 32 ou 64                   |

Le numéro de palette logique n'est pas un slot matériel. Le jeu applique d'abord la correspondance de la variante, puis le slot OBJ attribué dans la scène. Le bit haut de l'index de tile rejoint le bit 0 de l'attribut OAM. Le slot de palette rejoint les bits 1–3. La taille rejoint la table haute OAM selon le couple global choisi.

### Animation `.anim`

En-tête de 4 octets : flags `u8` (bit 0 boucle, bit 1 aller-retour), réservé `u8=0`, nombre d'images `u16`. Chaque image utilise un index de pose `u16` dans la liste de poses du personnage, puis une durée `u16` en images console. Événements, noms, collisions et attaches restent dans le manifeste. L'aller-retour n'insère pas les extrémités deux fois.

## Mémoire de scène

| Fichier                  | Utilisation                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `scene/vram.bin`         | Image complète de 65 536 octets, à transférer à VRAM depuis l'adresse mot `$0000` pendant le forced blank. |
| `scene/cgram.bin`        | 512 octets de CGRAM.                                                                                       |
| `scene/oam.bin`          | 544 octets : 512 de table basse et 32 de table haute.                                                      |
| `scene/layout.json`      | Placements, palettes, écritures de registres dans l'ordre et paramètres HDMA.                              |
| `scene/hdma-<canal>.bin` | Table HDMA directe terminée par zéro.                                                                      |
| `mode7.vram`             | 32 Kio de carte et pixels Mode 7 entrelacés sur les octets bas/haut des mots VRAM.                         |

`allocations[].address` est une **adresse en octets** dans l'image VRAM ; la diviser par deux pour `$2116`. `palettes[].address` est un index de couleur CGRAM ; `slot` est le numéro à utiliser dans les attributs BG/OBJ. `layer=4` signifie OBJ ; les valeurs 0…3 désignent BG1…BG4.

`registers` contient des couples `[adresseCpu, octet]`. Les registres à double écriture apparaissent deux fois, octet bas puis haut. Les tailles de sprites, les bases des données, la mosaïque, les écrans principal/secondaire et les mélanges sont communs à la scène. Les conflits de CGRAM, de VRAM ou de canaux HDMA bloquent cet export avec un message.

Le dégradé de ciel utilise trois canaux vers COLDATA et le mélange sur le fond. Il ne se combine pas avec un autre mélange de couleurs dans ce compilateur. La vague utilise deux écritures sur le défilement horizontal d'un BG. L'iris utilise les limites gauche/droite de la fenêtre 1. La perspective Mode 7 réserve deux canaux pour les coefficients de matrice. Les déplacements par tiles utilisent BG3 comme table d'offsets pour BG1 ; le premier segment à gauche suit le comportement matériel sans offset. En mode 4, chaque colonne choisit un décalage horizontal ou vertical.

## ROM de démonstration

Le générateur produit des sources ca65 autonomes et une configuration LoROM. Il prépare une boucle de 1 à 600 images : OAM, CGRAM, registres, HDMA et différences de VRAM sont mis à jour pendant la période verticale disponible. Un plafond de **4096 octets DMA par image** et une estimation conservatrice du coût des instructions/transferts sont appliqués, avec une fenêtre réduite en 239 lignes. Une transition trop coûteuse est refusée avec son numéro d'image. Le temps d'exécution complet du jeu n'est pas modélisé. L'activation initiale du HDMA attend le vblank.

Le projet de démonstration inclut ses instructions de compilation. Le CLI et l'hôte natif corrigent le checksum après l'assemblage. Les sources fonctionnent sans bibliothèque de moteur. Leur intégration dans un jeu demande de choisir sa propre stratégie de chargement.

## Références de formats

- [Format officiel Aseprite](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md) : structure des frames, cels, palettes et tags.
- [Registres PPU dans bsnes](https://github.com/bsnes-emu/bsnes/blob/master/bsnes/sfc/ppu/io.cpp) : tailles OBJ, adresses VRAM, fenêtres, mélange et ordre des priorités.
- [Rendu des BG dans bsnes](https://github.com/bsnes-emu/bsnes/blob/master/bsnes/sfc/ppu/background.cpp) : paires haute résolution et offsets par tiles.
- [API Lua Mesen](https://github.com/SourMesen/Mesen2/blob/master/Core/Debugger/LuaApi.cpp) : capture du résultat émulé pour la vérification de la ROM.

Les entrées `animatedTiles` peuvent contenir un `name` facultatif (chaîne).
Les projets sans ce champ restent valides ; l’interface affiche leur numéro de tile.

Les entrées `allocations` de la mémoire de scène peuvent inclure `resource`, identifiant du dessin ou de la carte propriétaire. Les allocations globales (OBJ, données Mode 7) n’ont pas nécessairement de propriétaire unique. Les adresses VRAM sont en octets ; les adresses de `palettes` restent des indices CGRAM (2 octets par entrée).
