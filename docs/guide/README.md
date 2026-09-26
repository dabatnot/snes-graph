# Maintenir le manuel utilisateur

Ouvrir le manuel [français](index.html) ou [anglais](en.html) dans un navigateur. Aucun serveur, compilation ou téléchargement de dépendance n’est nécessaire. Conserver `index.html`, `en.html`, `style.css`, `guide.js` et `assets/` ensemble. Le sélecteur Français / English conserve l’ancre du chapitre avec JavaScript et reste un lien normal sans JavaScript.

## Modifier le contenu

1. Modifier directement le chapitre concerné dans **les deux éditions**, `index.html` (FR) et `en.html` (EN). Chaque chapitre est un `<section class="chapter" id="…">` ; conserver ses identifiants pour ne pas casser les liens partagés.
2. Décrire le comportement réellement présent, avec le libellé exact des commandes dans la langue de chaque édition, l’unité des champs, le résultat attendu et les limites locales. Ne pas déduire une fonction de la seule vision de `../specs.md`.
3. Ajouter le lien au sommaire `#toc` si un chapitre est créé. La recherche indexe automatiquement le texte des chapitres au chargement.
4. Mettre à jour la version/date dans l’en-tête, le pied et les informations de provenance si nécessaire.
5. Ouvrir le fichier localement et contrôler la section modifiée, les liens, les images et une recherche pertinente. Vérifier aussi la vue étroite et l’aperçu d’impression si la mise en page change.

Les fichiers CSS et JS ajoutent seulement la présentation, le filtrage des chapitres et l’agrandissement des captures. Le contenu reste lisible sans JavaScript. Pas de bibliothèque externe ni de générateur documentaire à maintenir.

## Correspondance avec l’application

| Source à examiner quand elle change                                                      | Chapitres à relire                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/App.tsx`                                                                            | Démarrer, interface, projets, ressources, import, raccourcis |
| `src/platform.ts`, `src-tauri/src/main.rs`                                               | Bureau/web, fichiers, récupération, lancement, ROM           |
| `src/ui/Drawing.tsx`, `src/core/pixels.ts`                                               | Dessins, calques, sélections, transformations                |
| `src/ui/Palettes.tsx`                                                                    | Palettes, verrous, permutation, cycles                       |
| `src/ui/Sprites.tsx`, `src/core/model.ts`                                                | Pièces, variantes, poses, animations, boîtes, attaches       |
| `src/ui/Maps.tsx`, `src/core/terrain.ts`                                                 | Cartes, tampons, terrains, tiles animées                     |
| `src/ui/Scenes.tsx`, `src/core/render.ts`                                                | Scènes, effets, portée et limites de l’aperçu                |
| `src/ui/Exports.tsx`, `src/core/snes.ts`, `src/core/scene-export.ts`, `src/core/demo.ts` | Exports, optimisation, placement, ROM, diagnostics           |
| `src/core/import.ts`, `src/core/aseprite.ts`                                             | PNG, Aseprite, conversion, tramage                           |
| `src/core/archive.ts`, `src/core/resources.ts`                                           | Format projet, validation, duplication, usages, remplacement |
| `scripts/export.ts`, `docs/formats.md`, `docs/status.md`                                 | CLI, formats, limites et validation                          |

Tous les chemins de cette table sont relatifs à la racine du dépôt.

## Renouveler les captures

- Utiliser une copie du projet d’exemple, fenêtre 1440 × 920, interface FR pour `assets/` et EN pour `assets/en/`. Les captures FR datent du 26 septembre 2026, les EN du 27 septembre 2026, sous Fedora/Wayland, application native 0.1.0.
- Capturer la véritable interface. Ne pas reconstruire une fausse fenêtre avec du HTML ni présenter le canevas de l’éditeur comme une capture d’émulateur.
- Fermer les fenêtres de dialogue parasites. Arrêter la lecture pour une capture reproductible ; préciser toute modification de l’exemple dans la légende.
- Garder le nom du fichier si le rôle de la capture reste le même. Mettre à jour les attributs `width`, `height`, `alt` et la légende si le contenu ou la taille change.
- Conserver les captures originales en PNG ; les annotations pédagogiques se font dans la légende ou dans des schémas distincts.
- Réouvrir les PNG et le HTML pour contrôler lisibilité, absence de données privées et bon cadrage.

### Inventaire des captures

| Fichier                    | Projet et parcours                                   | État                                                                                                    |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `01-dessins.png`           | Football → Dessins → Joueur                          | Palette Domicile, grille, zoom 1000 %                                                                   |
| `02-palettes.png`          | Football → Palettes → Domicile                       | Entrée 1 sélectionnée                                                                                   |
| `03-palette-exterieur.png` | Football → Palettes → Extérieur                      | Entrée 1 sélectionnée                                                                                   |
| `04-sprites.png`           | Football → Sprites → Joueur                          | Pose initiale, Marche, lecture arrêtée                                                                  |
| `05-variantes.png`         | Même atelier → Comparer                              | Original, Domicile, Extérieur                                                                           |
| `06-cartes.png`            | Football → Cartes → Terrain                          | Inspecteur en haut, zoom 200 %                                                                          |
| `07-metatiles.png`         | Même atelier                                         | Inspecteur en bas, aucune ressource ajoutée                                                             |
| `08-scenes.png`            | Football → Scènes → Match                            | Image 0, zoom 200 %                                                                                     |
| `09-export.png`            | Football → Exporter                                  | Toutes les ressources ; scène Aucune                                                                    |
| `10-rom.png`               | Football → Exporter → scène Match                    | Ensemble créé pour la capture, outils dépliés ; modification ensuite annulée sans enregistrer l’exemple |
| `11-creation.png`          | Football → Cartes → +                                | Dialogue seulement ; création non validée                                                               |
| `12-usages.png`            | Football → Cartes → Terrain → Usages et remplacement | Dialogue seulement ; aucun remplacement                                                                 |
| `13-mode7.png`             | `examples/mode7.snesgraph` → Scènes                  | Image 0, inspecteur en haut                                                                             |
| `14-hdma.png`              | `examples/hdma.snesgraph` → Scènes                   | Image 0, inspecteur en haut                                                                             |
| `15-effets-reglages.png`   | Même projet HDMA                                     | Inspecteur en bas, paramètres wave/iris                                                                 |
| `16-mode7-reglages.png`    | Projet Mode 7 → Scènes                               | Inspecteur en bas, angle/scale/perspective/horizon                                                      |

Les quatre schémas SVG sont intégrés au HTML : dépendances des ressources, coût de 100 tiles, chronologie de Marche, allocation des canaux HDMA. Leurs valeurs sont des explications calculées, pas des mesures.

## Publication

Le manuel se consulte directement depuis le disque. Pour un site hébergé, servir des fichiers statiques suffit. Aucun compte, cookie, service distant ou recherche côté serveur n’est utilisé. La recherche est faite dans le texte déjà chargé.

Les liens complémentaires vers le README racine, `docs/formats.md`, `docs/status.md` et `examples/` supposent l’arborescence actuelle. Pour publier uniquement le dossier guide, adapter ces liens ou fournir les documents liés à côté ; le texte, les captures, les tableaux et les schémas du manuel lui-même restent autonomes.

La commande « Imprimer / PDF » utilise le dialogue du navigateur : elle ne produit pas un PDF versionné dans le dépôt. Si un PDF est distribué plus tard, noter sa date séparément et contrôler ses pages après chaque mise à jour.

## Contrôles de l’édition initiale

Le 26 septembre 2026 :

- 20 chapitres, 33 tableaux, 16 captures natives et 4 schémas SVG ; environ 13 000 mots.
- Structure HTML, unicité des identifiants, ancres internes, fichiers locaux liés et présence des textes alternatifs contrôlés ; aucun lien local manquant.
- JavaScript vérifié avec `node --check` ; fichiers mis en forme avec le Prettier du projet.
- Lecture réelle dans Chrome depuis `file://` : page d’accueil, section Palettes, schéma des ressources et tableau, recherche « CGRAM » (6 chapitres), remise à zéro, agrandissement d’une capture puis fermeture.
- Mise en page compacte observée à 150 % dans une fenêtre de 921 pixels, avec ouverture du sommaire ; cela vérifie le point de rupture CSS, pas un appareil mobile physique.
- Dialogue d’impression ouvert après filtrage : le manuel complet est repris (52 pages avec les réglages de cette session), page de couverture inspectée. Aucun PDF distribué ni audit visuel de chaque page imprimée n’est revendiqué.

Les commandes ont été décrites par lecture des fichiers de l’application, complétée par les captures et manipulations indiquées. Ce travail documentaire n’est pas une nouvelle validation exhaustive de toutes les combinaisons graphiques, exports et plateformes.

## Mise à jour : agrandir un dessin

La capture `17-ajouter-tiles.png` montre `examples/football.snesgraph` dans Dessins → Terrain, après un clic sur **+ Ligne de tiles** (16 × 16 pixels). Capture de la version native Linux ; modifications annulées sans enregistrer l’exemple. Le bouton de bibliothèque affiche désormais **+ Nouveau** ; les captures plus anciennes peuvent encore montrer l’ancienne icône.

Vérification native : ajout d’une ligne, ajout d’une colonne (24 × 16), deux annulations ramenant à 16 × 8, puis ouverture du dialogue par + Nouveau. Compilation web/native et 18 tests réussis.

## Passe détaillée de l’interface — 26 septembre 2026

Le manuel comprend désormais 20 chapitres, 55 tableaux, 17 vues générales, 197 captures ciblées et 4 schémas SVG. Les dix outils de dessin et les commandes des six ateliers sont illustrés, avec leur effet, leur portée et des exemples football. Les dialogues de création et d’import PNG sont également détaillés.

Les extraits sont dans `assets/ui/`. `capture-regions.json` associe chaque nom d’extrait à sa capture source et à un rectangle `[gauche, haut, droite, bas]` en pixels. Les sources supplémentaires portent le préfixe `source-` ; les autres sources sont les vues générales de `assets/`. Pour renouveler un extrait :

1. Reproduire l’état sur une copie du projet football dans une fenêtre native de 1440 × 920, dans chaque langue concernée.
2. Enregistrer la vraie capture source puis contrôler son contenu. Si les contrôles ont changé de position, adapter le rectangle dans le manifeste.
3. Recadrer sans redessiner les boutons ; avec Pillow : `Image.open(source).crop(box).save(destination)`.
4. Actualiser les dimensions et le texte alternatif du `<img>`, ainsi que la légende `data-caption` du lien `data-zoom`.
5. Contrôler le tableau et son agrandissement dans le navigateur. Les images sont chargées dès l’ouverture pour être disponibles à l’impression, même dans un chapitre masqué par la recherche.

### États des nouvelles captures sources

Tous les parcours suivants partent d’une copie de Football ; les ajouts temporaires ont été annulés et les dialogues fermés sans validation.

| Source dans `assets/ui/`                                                                 | État à reproduire                                                                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `source-dessin-terrain.png`, `source-dessin-selection.png`                               | Dessins → Terrain, inspecteur en haut puis en bas ; zoom 1000 %.                                                      |
| `source-calques.png`                                                                     | Terrain → + Calque ; Base et Calque 2, second calque sélectionné.                                                     |
| `source-cycle.png`                                                                       | Palettes → Domicile → entrée 1 ; cycle activé de 1 à 15, 8 ticks ; bas de l’inspecteur.                               |
| `source-variante-piece.png`, `source-piece.png`                                          | Sprites → Joueur → variante Extérieur ; première pièce de la tête sélectionnée ; inspecteur en haut puis au centre.   |
| `source-collision.png`, `source-attache.png`                                             | Ajouter une collision par défaut (0, 0, 16, 16), puis une attache (0, 0) ; inspecteur en bas.                         |
| `source-tile-animee.png`                                                                 | Cartes → Terrain → Animer la tile 0 ; séquence 0, 8 ticks.                                                            |
| `source-carte-remplir.png`, `source-carte-prelever.png`, `source-carte-selectionner.png` | Cartes → Terrain ; choisir successivement ces outils sans peindre.                                                    |
| `source-bg.png`                                                                          | Scènes → Match ; inspecteur dans la section BG1.                                                                      |
| `source-instance.png`                                                                    | Match → première instance dépliée ; position 88, 130 et vitesses nulles.                                              |
| `source-melange.png`                                                                     | Match → bas de l’inspecteur ; mélange Aucun.                                                                          |
| `source-cgram.png`                                                                       | Match → ajouter une réservation Domicile, OBJ, emplacement 0.                                                         |
| `source-gradient.png`                                                                    | Match → ajouter un dégradé avec ses réglages par défaut, canal 0.                                                     |
| `source-import.png`                                                                      | Importer un PNG issu du rendu du dessin Joueur ; nouvelle palette, sans tramage, aucun pixel ajusté ; ne pas valider. |
| `source-creation-dessin.png`                                                             | Dessins → + Nouveau ; nom vide, 32 × 32, 4 bpp ; ne pas valider.                                                      |

Les vues générales 01, 02, 04, 06, 07, 08 et 09 ont été renouvelées avec **+ Nouveau**. Les réglages ROM, wave/iris et Mode 7 utilisent les captures antérieures de champs inchangés. Les rectangles exacts font foi dans le manifeste.

### Vérification de cette passe

- Contrôle des fichiers liés, ancres, identifiants, textes alternatifs, dimensions et correspondance des recadrages avec leurs sources ; syntaxe JavaScript et formatage des fichiers documentaires.
- Lecture dans Chrome depuis le disque : outils de dessin, inspecteur, palettes et découpage ; ouverture/fermeture de l’agrandissement d’un bouton.
- Affichage compact à 300 % dans une fenêtre de 1878 pixels, avec ouverture du sommaire ; recherche « tramage » donnant les deux chapitres concernés.
- Aperçu d’impression : couverture et page de tableau illustré contrôlées. Il ne s’agit pas d’un audit de toutes les pages ni d’un PDF distribué.

Cette passe ne modifie pas l’application et n’ajoute aucune dépendance à la documentation.

## Corrections issues de la revue initiale — 26 septembre 2026

Mise à jour ciblée des passages sur la sauvegarde/récupération, les raccourcis avec Majuscule, le bornage des sélections de carte, le changement de tileset, les poses affichées après annulation, la permutation des palettes, les PNG indexés/niveaux de gris et la transparence par couleur. Le chapitre Exporter renvoie aux nouvelles correspondances de tiles décrites dans `../formats.md`. Les commandes et leurs libellés restent identiques : les captures existantes sont conservées.

Validation applicative : 32 tests automatisés réussis, compilation TypeScript/Vite réussie. Parcours web dans Chrome : Ctrl+Maj+Z, Ctrl+Maj+S, récupération puis modification/annulation avec avertissement de sauvegarde, création/annulation d’animation suivie d’un renommage, duplication/annulation de pose suivie d’un découpage, réduction d’une carte de 32 à 16 colonnes après sélection en colonne 20 puis capture du tampon et sauvegarde. Les entrelacements de sauvegarde ont aussi été vérifiés avec des écritures différées contrôlées ; ce contrôle ne constitue pas un essai de panne disque réelle.

## Édition anglaise — 27 septembre 2026

`en.html` reprend les 20 chapitres, 55 tableaux, 4 schémas SVG et 214 illustrations du manuel français. Les légendes, textes alternatifs, commandes du manuel et résultats de recherche sont traduits. Les noms enregistrés dans les projets restent inchangés (Joueur, Domicile, Extérieur, Terrain, etc.) et sont expliqués à l’accueil anglais.

Les 17 vues générales et les sources des 197 extraits ont été **recapturées dans l’application native en anglais**, reconstruite depuis les sources courantes. Les manipulations utilisent des copies des exemples football, Mode 7 et HDMA, sans enregistrer les changements dans les exemples du dépôt. Les sources supplémentaires sont dans `assets/en/ui/source-*.png`. Le manifeste `capture-regions-en.json` donne leurs rectangles propres : ne pas recopier aveuglément les rectangles FR, car les libellés EN déplacent certains contrôles. `bg-ajouter` utilise notamment `source-melange.png`, où ce bouton est entièrement visible. Les valeurs et parcours restent ceux de l’inventaire FR ; la pièce sélectionnée pour les champs de sprite est la moitié droite de la tête (source X = 16).

Pour chaque évolution utilisateur, mettre à jour les deux textes et renouveler les images concernées dans chaque langue. Conserver les mêmes identifiants de chapitres et sous-sections pour que le sélecteur garde le passage consulté. Les deux HTML sont édités directement ; aucun générateur ni dictionnaire de traduction intermédiaire n’est nécessaire. CSS et JavaScript sont partagés. Les documents techniques liés (`formats.md`, `status.md`, README) conservent leur langue propre.

Contrôles de cette édition : intégrité des ancres et fichiers locaux, parité des chapitres/tableaux/schémas/illustrations, textes alternatifs, dimensions des images, syntaxe JavaScript et formatage. Les 197 extraits EN ont été inspectés sur des planches de contrôle, et leurs sources natives observées pendant la capture. Lecture réelle dans Firefox depuis `file://` : accueil, palettes, tableau des outils, passage FR → EN et EN → FR conservant le chapitre, recherche EN « HDMA » (5 chapitres), remise à zéro et agrandissement d’un bouton avec légende EN. L’aperçu d’impression après filtrage reprend le document complet ; sa couverture a été inspectée, sans impression physique ni contrôle de chaque page.

La recherche FR « CGRAM » a également été vérifiée (6 chapitres). Le menu compact et son sélecteur de langue ont été ouverts à 260 % dans la fenêtre Firefox de 1878 pixels (environ 722 pixels CSS), puis le zoom a été rétabli à 100 %. Cela vérifie le point de rupture, pas un appareil mobile physique.
