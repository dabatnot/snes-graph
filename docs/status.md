# État de l'implémentation

État au 26 septembre 2026. La vision de `specs.md` reste plus large qu'une liste de boutons : la présence d'un réglage ne prouve pas à elle seule son exactitude sur console.

## Réalisé

Application Tauri/React/TypeScript, ateliers reliés par un modèle partagé, interface français/anglais, historique, récupération, projets ZIP autonomes et exports en worker. Palettes nommées de 4/16/256 entrées, variantes partageant pixels et animations. Dessin indexé avec calques, sélections, transformations et agrandissement par lignes ou colonnes de tiles ; composition de sprites, animation, collisions et attaches. Cartes, métatiles, terrains à 16 règles, tiles animées, scènes et effets. Import PNG et Aseprite raster, réimport PNG conservant les références à dimensions/profondeur identiques. Exports binaires documentés, CLI, sources ca65 et ROM de démonstration.

Les modes 0 à 7 disposent de réglages et d'un export de mémoire. La haute résolution, les couleurs directes, EXTBG, les offsets de BG1 et les tables HDMA disposent d'une implémentation initiale. Leur couverture de vérification est détaillée ci-dessous ; ils ne sont pas annoncés comme une émulation PPU exhaustive.

## Vérifications effectuées

- Compilation TypeScript et Vite réussie.
- `cargo check`, compilation native de développement et construction du RPM et de l'AppImage réussis sous Fedora/Linux x86-64. Les bibliothèques de développement absentes du système ont été extraites dans un SDK temporaire ; aucune installation système n'a été effectuée. La construction AppImage utilise `NO_STRIP=1` pour les bibliothèques récentes de Fedora.
- 32 tests automatisés ciblés (dont conservation des calques et références lors de l’agrandissement des dessins, PNG indexés/niveaux de gris et transparence par couleur, permutation des palettes, animations Mode 7 et références après optimisation) : bitplanes, archives et références, variantes, tilemaps 64 colonnes, déduplication et miroirs, transparence PNG, conflit CGRAM, débordement OBJ, génération ca65, calques, import Aseprite, raccords de terrain, occurrence locale, réservation et stabilité des palettes animées, dépendances d'export et concordance de la VRAM entre export et ROM.
- Interface ouverte dans Chrome : dessin et annulation d'un trait, chargement du projet football, assemblage, comparaison simultanée des variantes, déplacement d'une instance puis annulation, conversion 50/60 Hz, changement de langue, export par worker, récupération du projet après rechargement et enregistrement.
- Interface native vérifiée sous Fedora/Wayland : lancement direct du binaire release recompilé, ouverture de `examples/football.snesgraph` par argument, affichage du dessin et navigation vers la scène avec les deux tenues visibles. Le démarrage applique une configuration Fontconfig limitée et désactive DMA-BUF pour contourner une boucle de recherche de polices observée dans GDB et une erreur de protocole Wayland. Ces réglages sont propres au processus ; voir le README.
- ROM football assemblée avec ca65/ld65 et exécutée dans Mesen. Capture à l'image 40 : terrain et deux joueurs avec tenues distinctes visibles. Cela constitue une vérification émulateur de ce parcours.
- Deux autres ROMs ont été assemblées et observées dans Mesen : motif Mode 7 en rotation/perspective et scène combinant dégradé, vague et iris. Un défaut d'activation HDMA au milieu de la première image a été corrigé en attendant le début du vblank ; les exécutions suivantes ne signalent plus les lectures non initialisées observées initialement. Les projets correspondants sont fournis dans `examples`.

## Corrections de la revue initiale

La revue de `develop` contre une base vide a corrigé les imports PNG à échantillons compactés et transparence par couleur, le suivi des sauvegardes en cours et récupérées, les raccourcis avec Majuscule, les références d’édition des poses/animations après annulation, les sélections après réduction de carte et les dépendances de palette/tileset. Les tiles animées Mode 7 sont résolues à l’export et le manifeste expose les correspondances des tiles optimisées ainsi que les occurrences animées.

Ces corrections n’introduisent pas de nouveau format de projet. Les champs ajoutés au manifeste d’export sont décrits dans `formats.md`. Les parcours de régression web observés sont consignés dans `guide/README.md`. Le binaire natif et les installateurs de cette passe n’ont pas été reconstruits.

## Limites à connaître

- **Windows** : le workflow GitHub Actions de l’import initial `9726792` a réussi ; les corrections de revue ont été compilées en web sous Linux. Aucun parcours utilisateur Windows observé ici.
- **Interface native** : démarrage et navigation vérifiés visuellement sous Fedora/Wayland ; l'installation des paquets et les dialogues de fichiers natifs restent à vérifier séparément. La configuration de polices limitée peut réduire la couverture de certains caractères.
- **Console réelle** : aucune vérification effectuée.
- **Aperçu PPU** : le rendu de travail ne reproduit pas tous les détails de timing, d'entrelacement et de perte de sprites en surcharge. Les priorités et effets avancés demandent des comparaisons complémentaires dans l'émulateur. Les limites OBJ sont diagnostiquées, mais l'ordre exact de disparition en surcharge n'est pas garanti dans l'aperçu.
- **Aseprite** : couches raster avec fusion normale uniquement. Groupes, modes de fusion spéciaux, Z-order et tilemaps doivent être aplatis/rastérisés dans le logiciel source avant l'import. Les durées sont arrondies à des images console et les couleurs converties vers la palette choisie.
- **Réimport** : PNG à dimensions et profondeur conservées. Aplatir les calques avant un réimport. Aucun rapprochement automatique d'assemblages lorsque la grille de la source change.
- **Rotation** : les rotations de dessin sont proposées sur une sélection carrée pour préserver les dimensions et les références des tiles. Miroirs et déplacements restent disponibles sur les sélections rectangulaires.
- **CGRAM** : placement automatique et slots imposés par palette/BG/OBJ. Les conflits restent bloquants ; les modes 8 bpp utilisent des couleurs que les OBJ peuvent aussi réclamer.
- **Optimisation** : déduplication d'export, miroirs, comparaison du coût des découpages réguliers et création d'une occurrence indépendante. Pas de solveur qui garantisse un optimum global entre mémoire, OAM et transferts.
- **Grandes cartes** : la galerie charge progressivement les lignes/colonnes et permet une exploration à la manette. L’export générique conserve ses blocs ; la stratégie de streaming d’un jeu reste à écrire ; une ROM de prévisualisation peut refuser une transition trop volumineuse pour son budget DMA. Les grandes cartes combinées à des offsets par ligne/tile sont refusées dans l'export de scène ; l'export de carte seul reste disponible pour une intégration propre au jeu.
- **Historique** : snapshots, jusqu'à 50 opérations avec une estimation de rétention limitée à 128 Mio (au moins une opération conservée). Les très gros projets doivent encore faire l'objet d'un profilage mémoire réel.

## Vérifier la ROM dans Mesen

```sh
npm run export -- examples/football.snesgraph artifacts/football --scene Match --rom
SNES_GRAPH_TEST_OUTPUT="$PWD/artifacts/football" Mesen --testrunner --timeout=15 --enableStdout --debug.scriptWindow.allowIoOsAccess=true artifacts/football/demo/demo.sfc scripts/verify-rom.lua
```

Le script nécessite les entrées/sorties Lua pour écrire uniquement sa capture et son état dans le répertoire de test. Le mode test de Mesen ne sauvegarde pas ce réglage. `artifacts/football/mesen.png` est la capture émulée ; elle ne provient pas du moteur d'aperçu de l'éditeur.

## Évolution : navigation et ressources

Navigation carte → dessin source → retour, création contextualisée de tile,
utilisation d’un dessin dans une carte ou un sprite, tri et filtres d’usage,
usages navigables. Tampons et terrains renommables, duplicables et supprimables ;
animations de tiles nommables et supprimables. La suppression d’un terrain
conserve ses pixels peints ou applique explicitement un terrain de remplacement.
Parcours de création/retour et captures FR/EN vérifiés dans Chrome.

Redimensionnement avec neuf ancrages, recadrage, insertion/retrait de lignes et
colonnes, échange de blocs de tiles disponibles. Les références sont remappées ;
une pièce fragmentée ou une référence supprimée non remplacée bloque l’opération.
Tests ciblés : préservation des rendus et calques, références secondaires et refus
sans mutation. Agrandissement et annulation observés dans Chrome.

Comparaison de palettes et aperçu synchronisé, remappage explicite des indices,
application de palette à une région de carte ou une sélection de pièces,
duplication de variante et application à plusieurs instances du même acteur.

Sélection multiple et rectangulaire des pièces, transformations collectives,
repères d’origine/attaches/collisions manipulables, copie de placement de groupes.
Séquences : sélection, duplication/suppression, réorganisation, durée commune,
curseur et boucle temporaire de plage. Duplication/annulation observée dans Chrome.

Régions de cartes : copie, déplacement, miroirs, rotation 90° avec prévisualisation
et déduplication, conservation des attributs, agrandissement explicite de la carte.
Les associations de terrain sont retirées des cellules transformées. Les nouvelles
tiles animées utilisent des bases indépendantes. Aperçu de rotation observé dans Chrome.

- Lot 6 : diagnostic mémoire issu du compilateur, liens vers ressources, lignes OBJ et instances contributrices, analyse annulable de 1 à 600 images. UI web FR/EN observée ; deux tests ciblés et build réussis.

- Import : original/conversion/masque des pertes, alpha et marge ; réimport avec tiles modifiées et usages, palette conservée.

## Galerie interactive — 27 septembre 2026

Ajout des modes Galerie interactive / Scène en boucle, sélection indépendante des scènes, fermeture automatique des dépendances par vue, manette du port 1 et panneau Start. Les cartes sont explorables intégralement avec chargement progressif ; les personnages conservent leurs animations et variantes. La CLI accepte `--gallery`, `--rom` et `--language fr|en`.

Parcours Mesen reproductible :

```sh
node --import tsx scripts/verify-gallery.ts /chemin/vers/Mesen
```

Les captures et ROMs sont produites sous `artifacts/gallery-validation/`. Les essais observés couvrent les menus FR/EN, les trois catégories, pause/pas à pas, variantes, animations bouclées/ping-pong/non bouclées, relance d’une animation terminée et changement de personnage sans répétition sur maintien de R. Une carte de 129 × 97 tiles a été parcourue aux quatre coins avec vérification des cellules VRAM. Les retours de panneau sur sprites, scène Football, Mode 7 et HDMA restituent des captures identiques à la vue mise en pause. Les exécutions finales ne signalent pas de lecture non initialisée.

Interface web : choix des deux modes, sélection de la scène de référence et export des sources de galerie par worker vérifiés ; le statut « Export enregistré » a été observé. Captures FR/EN renouvelées. Les tests ciblés assemblent aussi des sources 50/60 Hz, des petites cartes et des cartes animées. Aucun essai sur console physique ; le paquet natif n’a pas été reconstruit pour cette fonctionnalité.

Validation finale : 53 tests réussis, compilation TypeScript/Vite réussie ; l’export CLI Scène en boucle de Football a aussi été recompilé et observé dans Mesen (terrain et deux joueurs). Une carte de 32 × 24 pixels a été observée centrée avec sa bordure vide.

Après ces validations, le binaire natif `src-tauri/target/release/snes-graph` a été reconstruit avec succès via `tauri build --no-bundle` pour les essais locaux. Les installateurs RPM/AppImage n’ont pas été régénérés.

### Logo et texte des ROMs

Texte de galerie limité à A–Z/a–z/0–9, autres caractères remplacés par des espaces ; noms du projet inchangés. Icône SNES Graph de 16 × 16 pixels superposée dans les deux modes ROM, soumise aux effets de scène. Respect des allocations existantes, réutilisation des couleurs les plus proches si la CGRAM est entièrement occupée, diagnostics en cas de manque de VRAM/OBJ.

54 tests réussis, cinq parcours Mesen répétés avec captures FR/EN renouvelées, Scène en boucle compilée et exécutée dans Mesen. Binaire natif release reconstruit avec succès ; installateurs non reconstruits et aucune validation sur console physique.

## Aide, versions et licences — 0.2.0

- Menu Aide/Help : manuel hors ligne indépendant, nouveautés bilingues, À propos
  (version et copie), licence MIT et notices des composants tiers.
- Renommage depuis le nom du projet : validation, abandon et annulation dans
  l’historique. Ancienne aide courte remplacée ; raccourcis conservés dans le manuel.
- Version npm de référence synchronisée vers Rust, Tauri et les fichiers de verrouillage ;
  contrôle à la compilation et en CI. Historique reconstitué des commits des 26/27
  septembre 2026, sans inventer d’anciennes versions publiées. Export Markdown FR/EN.
- Deux éditions du manuel et tous leurs fichiers locaux liés embarqués. La fenêtre
  du manuel n’a aucune permission pour écrire des projets ou compiler des ROMs.
- Notice MIT dans les sources des deux ROMs et dans les exemples assembleur.
  Les créations de l’utilisateur restent sous leur propre licence.

Validation : 59 tests réussis (11 fichiers), puis contrôle ciblé des fins de ligne Windows ; compilation TypeScript/Vite et binaire release Linux réussis ; tests
ciblés de versions, notes FR/EN, fichiers hors ligne, réutilisation d’onglet et licences
réussis. Compilation ca65/ld65 des modes Scène en boucle, Galerie et des trois
exemples d’intégration réussie. Contrôle des 108 ancres et 498 liens de chaque manuel
compilé ; captures natives FR/EN renouvelées (menu, À propos, renommage, vue générale).

Parcours natif : nouveautés, licence et notices chargées hors ligne, copie de version,
manuel indépendant avec images, réutilisation conservant la lecture, changement FR/EN
et fermeture indépendante. Le contrôleur natif de clavier a expiré : Entrée, Échap
et annulation du renommage ont été observés dans la version web. La réutilisation
de l’onglet web est couverte par un test ciblé ; le navigateur de test intégré n’a
pas exposé l’onglet secondaire pour une observation réelle.

Inventaire : dépendances npm de production, graphes Cargo Linux/Windows et notices
natives identifiées ; outils de compilation séparés. Les bibliothèques système
Fedora sont explicitement distinguées des composants embarqués. Cet inventaire
ne certifie pas le contenu de futurs AppImage/RPM/installateurs Windows : audit
du paquet réellement produit requis avant publication, qui reste hors de cette
livraison. Aucun essai Windows ou console physique n’est revendiqué ici.
