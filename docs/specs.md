# Spécifications fonctionnelles — Éditeur graphique SNES

Ce document rassemble la vision fonctionnelle de l’éditeur et la gestion des variantes par palettes nommées discutées le 26 septembre 2026. Il décrit le produit envisagé ; il ne constitue pas un état des fonctionnalités implémentées.

## 1. Vision et principes

La promesse de l’éditeur est de **créer les graphismes d’un jeu SNES, les assembler, les animer et obtenir des données exploitables dans le jeu, en comprenant immédiatement les conséquences de chaque choix**.

Le caractère « ultime » vient de la continuité entre les outils :

- Changer une couleur et voir les personnages et décors concernés.
- Retoucher une tile et voir ses utilisations se mettre à jour.
- Affecter une autre palette nommée à un personnage et voir immédiatement sa nouvelle apparence dans toutes ses animations.
- Ajouter des ennemis dans une scène et voir où l’affichage devient problématique.
- Exporter les ressources avec des formats documentés et un résultat prévisible.

La priorité est la chaîne **palette → tiles → métasprite → animation → scène → export**. Chaque outil supplémentaire doit enrichir un environnement déjà utilisable.

La conception suit les principes KISS et YAGNI : répondre aux usages présents avec la solution la plus simple, éviter les abstractions prématurées et les composants sans valeur immédiate. La vision complète ne doit pas imposer de réaliser toutes les fonctions dès la première version.

L’interface présente ce qui aide l’utilisateur à comprendre, décider et agir. Les détails matériels apparaissent lorsqu’ils expliquent un choix ou un problème.

## 2. Usages et ressources du projet

L’éditeur répond à trois usages complémentaires : dessiner, composer les graphismes du jeu et préparer leur intégration technique. Une même personne doit pouvoir passer facilement de l’un à l’autre.

| Ressource | Rôle |
|---|---|
| Palette | Associer des couleurs aux indices utilisés par les pixels. |
| Tileset | Regrouper les tiles graphiques réutilisables. |
| Métatile | Assembler plusieurs tiles en un motif de décor : sol, mur, porte… |
| Tilemap | Placer les tiles ou métatiles pour construire un décor. |
| Métasprite | Assembler plusieurs sprites matériels pour représenter un personnage ou un objet. |
| Animation | Définir une succession de poses et leur durée. |
| Variante par palette | Associer des graphismes et animations partagés à une autre palette nommée. |
| Scène | Réunir décors, personnages, palettes et réglages d’affichage. |
| Ensemble d’export | Définir les ressources à fournir au jeu et leur organisation. |

La scène représente ce qui doit fonctionner ensemble à un instant donné. Le projet peut contenir des centaines de palettes ou de personnages ; les contraintes sont évaluées sur les ressources effectivement utilisées ensemble, plutôt que sur toute la bibliothèque.

## 3. Palettes nommées et variantes d’apparence

### 3.1. Édition des palettes

Les palettes sont des ressources nommées, partagées et réutilisables. Leur affectation à un personnage est indépendante de son dessin et de ses animations.

L’édition comprend :

- Sélection de couleur, saisie numérique et pipette.
- Dégradés et rampes d’ombre et de lumière.
- Copie de groupes de couleurs.
- Verrouillage de certaines entrées.
- Noms de palettes et noms de couleurs : « peau », « contour », « métal clair »…
- Visualisation de toutes les ressources utilisant une palette.
- Comparaison de plusieurs palettes sur une même ressource.
- Préparation de variantes jour, nuit, poison, gel ou changement de costume.
- Identification des couleurs inutilisées ou presque identiques.
- Réservation d’emplacements pour le HUD, les personnages ou certains effets.
- Prévisualisation des animations de palette.

L’utilisateur travaille avec les couleurs représentables par la SNES : composantes sur 5 bits, soit 32 768 valeurs possibles. La mémoire de palette contient 256 entrées ; leur utilisation dépend des couches et du mode graphique. Voir la [référence matérielle Fullsnes](https://problemkaputt.de/fullsnes.htm#snesppucolorpalettememorycgramanddirectcolors).

### 3.2. Réordonner, recolorer et gérer la transparence

Réordonner une palette et recolorer un dessin sont deux opérations distinctes :

- **Réordonner en conservant l’apparence** : remapper les indices des ressources concernées pour conserver exactement le rendu.
- **Recolorer** : conserver les indices et changer les couleurs associées.

La transparence et la couleur de fond sont clairement distinguées. Dessiner du noir ne doit jamais devenir transparent par accident.

L’affectation des palettes à la mémoire de la console se fait à l’échelle de la scène, avec détection des conflits entre ressources.

### 3.3. Changer de palette, créer une variante ou dupliquer une palette

Trois actions complémentaires sont proposées :

1. **Changer de palette** : sélectionner une autre palette nommée dans une liste et voir immédiatement le résultat sur le personnage et toutes ses animations.
2. **Créer une variante** : créer une variante nommée du personnage qui partage ses graphismes et animations, avec sa propre affectation de palette.
3. **Dupliquer une palette** : créer une nouvelle palette à partir d’une palette existante, puis modifier ses couleurs sans toucher à l’originale.

Créer une variante par palette ne duplique pas inutilement les pixels. Une correction du dessin ou de l’animation peut bénéficier à toutes les variantes qui partagent ces ressources.

Modifier une palette actualise les personnages qui l’utilisent. Affecter une autre palette à une variante ou à une instance ne modifie pas les autres variantes ou instances.

La portée de l’action doit être claire : édition de la palette partagée, choix de la palette d’une variante ou changement d’affectation d’une instance dans la scène.

### 3.4. Exemple : joueurs de football

| Variante | Graphismes et animations | Palette utilisée |
|---|---|---|
| Joueur domicile | Joueur de football | `Équipe France — Domicile` |
| Joueur extérieur | Les mêmes | `Équipe France — Extérieur` |
| Gardien | Graphismes du gardien | `Équipe France — Gardien` |

Les joueurs domicile et extérieur peuvent être présents ensemble dans une scène, dans les limites matérielles de cette scène.

Pour obtenir un changement cohérent, les palettes compatibles conservent la même fonction pour chaque emplacement de couleur :

| Emplacement nommé | Domicile | Extérieur |
|---|---|---|
| Maillot principal | Bleu | Blanc |
| Ombre du maillot | Bleu foncé | Gris |
| Détails du maillot | Blanc | Bleu |
| Peau | Teinte choisie | Même teinte |
| Contour | Noir | Noir |

Ainsi, changer de tenue ne recolore pas accidentellement le visage. Les noms facilitent la compréhension ; la correspondance des indices reste déterminante pour le rendu.

L’éditeur permet de comparer plusieurs variantes côte à côte et de les prévisualiser avec la même animation.

## 4. Dessin et édition des tiles

### 4.1. Outils de dessin

Le socle comprend les outils usuels du pixel art :

- Crayon, gomme, remplissage, pipette, lignes et formes simples.
- Sélections rectangulaires et libres.
- Déplacement, retournement, rotation et copie.
- Dessin symétrique.
- Grille réglable, zoom net et aperçu à taille réelle.
- Remplacement d’une couleur ou d’un indice.
- Prévisualisation répétée pour vérifier les raccords d’un décor.

L’utilisateur peut dessiner un personnage entier sans travailler obligatoirement tile par tile. Une grille montre le découpage lorsqu’il en a besoin.

Les formats de tiles SNES classiques sont pris en charge : 2, 4 et 8 bits par pixel, selon leur destination. Le Mode 7 demande un traitement spécifique. Voir l’[organisation des données graphiques](https://problemkaputt.de/fullsnes.htm#snesppuvideomemoryvram).

### 4.2. Ressources partagées

Lorsqu’une tile apparaît à plusieurs endroits, deux actions sont disponibles :

- **Modifier la tile partagée** et mettre à jour tous ses usages.
- **Créer une variante locale**, puis modifier uniquement cette occurrence.

L’utilisateur peut retrouver les usages d’une tile avant de la modifier.

Des calques de dessin peuvent faciliter la création. Leur transformation en ressources exportables reste explicite : un calque artistique ne correspond pas nécessairement à une couche matérielle de la SNES.

## 5. Assemblage des sprites

### 5.1. Composition des métasprites

Un personnage est manipulé comme un ensemble cohérent, composé de différentes pièces.

L’utilisateur peut :

- Glisser des tiles ou des blocs graphiques dans une zone d’assemblage.
- Positionner les pièces au pixel près ou avec un accrochage.
- Affecter une palette à chaque pièce.
- Régler les retournements et les priorités.
- Définir l’origine du personnage, par exemple au niveau des pieds.
- Grouper des pièces pour déplacer ensemble une tête, un bras ou une arme.
- Créer des points d’attache pour une épée, un projectile ou un effet.

L’éditeur montre à la demande la décomposition en sprites matériels. Les tailles disponibles dépendent d’un réglage commun ; elles ne peuvent pas être choisies librement pour chaque pièce. Voir le [registre de taille des sprites](https://wiki.superfamicom.org/registers#obsel---object-size-and-character-address).

Pour un personnage de 32 × 48 pixels, une décomposition possible est six sprites de 16 × 16. L’utilisateur voit le personnage complet et peut afficher les six rectangles qui le constituent.

### 5.2. Assistance au découpage

L’assistance propose plusieurs solutions en présentant leurs coûts :

| Critère | Question posée |
|---|---|
| Nombre de sprites | Combien d’entrées matérielles faut-il ? |
| Occupation graphique | Combien de tiles faut-il stocker ? |
| Réutilisation | Quelles pièces sont communes aux autres poses ? |
| Charge par ligne | Où le personnage contribue-t-il aux dépassements ? |
| Animation | Quelle quantité de données change entre deux poses ? |

Une solution ne doit pas être annoncée comme « optimale » selon un seul critère : réduire le nombre de sprites peut augmenter la quantité de graphismes à transférer.

## 6. Animations

La timeline permet de créer des animations nommées : attente, marche, course, attaque, dégâts…

Les fonctions comprennent :

- Durée réglable pour chaque image.
- Lecture en boucle, aller-retour et image par image.
- Pelure d’oignon.
- Duplication et liaison de poses.
- Synchronisation des points d’origine.
- Comparaison de directions et variantes.
- Animation coordonnée des palettes.

Une pose peut changer les pièces utilisées, leur position et leurs attributs. L’éditeur conserve les éléments partagés entre les poses.

Le choix d’une variante par palette s’applique à l’ensemble de l’animation sans nécessiter de recopier ou recolorer chaque pose.

Des boîtes de collision et des marqueurs temporels facilitent l’intégration : « impact », « apparition du projectile », « pied au sol ». Ces données sont exportées ; leur interprétation appartient au jeu.

La durée peut être exprimée en images console, avec un aperçu du résultat en 50 et 60 Hz. Une conversion destinée à conserver la même durée est une opération explicite.

## 7. Décors, métatiles et tilemaps

L’éditeur de tilemaps propose la peinture de tiles, les tampons, les sélections, le remplissage et le remplacement global.

Les métatiles permettent de travailler avec des éléments reconnaissables : morceau de plateforme, angle de mur, fenêtre, escalier…

Les fonctions avancées comprennent :

- Raccordement automatique de terrains.
- Variantes de motifs pour limiter les répétitions.
- Animation des tiles d’eau, de lave ou de végétation.
- Réglage des palettes et priorités par placement.
- Aperçu de plusieurs couches avec leur défilement.
- Informations de collision facultatives.
- Aperçu des raccords aux limites des cartes.

La carte complète du niveau est distinguée de la portion chargée pour l’affichage.

L’utilisateur peut créer un grand décor. L’éditeur montre ensuite les ressources nécessaires lorsque la caméra se déplace et prépare les données de chargement adaptées au format choisi. Le programme du jeu reste responsable de leur chargement effectif.

## 8. Composition des scènes

La scène réunit les ressources destinées à apparaître ensemble :

- Décors et couches de fond.
- Instances de personnages et d’objets, avec leurs variantes et palettes.
- HUD et éléments d’interface.
- Palettes actives.
- Animations et trajectoires simples de prévisualisation.
- Réglages d’affichage.

L’utilisateur peut déplacer une caméra, faire défiler un décor et multiplier les instances d’un ennemi pour observer le résultat.

Un changement de mode graphique produit une explication de ses conséquences : ressources compatibles, couches à réaffecter, conversion nécessaire ou information perdue. Les graphismes ne sont pas modifiés silencieusement.

Deux vues sont complémentaires : un aperçu net au pixel près et un aperçu du format d’affichage visé. Les effets de téléviseur restent facultatifs et clairement présentés comme une simulation.

## 9. Modes graphiques et effets avancés

La vision complète couvre les modes 0 à 7 et leurs particularités : haute résolution, couleurs directes, décalages par tiles, transformation du Mode 7, fenêtres de masquage et opérations de couleur. Voir la [documentation PPU](https://problemkaputt.de/fullsnes.htm#snespictureprocessingunitppu).

Les outils présentent ces possibilités sous forme d’effets compréhensibles :

| Effet recherché | Manipulation proposée |
|---|---|
| Ciel en dégradé | Définir des couleurs et leur position verticale. |
| Eau ondulante | Régler l’amplitude et la vitesse d’une déformation. |
| Parallaxe | Définir le déplacement relatif des couches. |
| Ouverture en iris | Dessiner et animer une fenêtre de visibilité. |
| Brume ou éclairage | Régler les opérations de couleur autorisées. |
| Carte Mode 7 | Manipuler le centre, l’angle et l’échelle. |
| Route en perspective | Régler l’horizon et la transformation selon les lignes. |

Ces commandes produisent un aperçu, les données nécessaires et les conditions d’intégration, notamment pour les effets utilisant le HDMA.

L’éditeur montre les interactions entre effets : ressources communes, réglages incompatibles ou canaux de transfert déjà utilisés. Une combinaison impossible est signalée au moment de sa composition.

## 10. Diagnostics et contraintes matérielles

Quelques limites matérielles sont intégrées dès la conception : 64 Kio de VRAM, 128 sprites matériels et deux limites distinctes par ligne, 32 sprites et 34 portions de sprites de huit pixels. Voir [Fullsnes](https://problemkaputt.de/fullsnes.htm) et les [indicateurs de dépassement](https://wiki.superfamicom.org/registers#stat77---ppu-status-flag-and-version).

Le logiciel traduit les contraintes en informations exploitables :

| Problème | Réponse attendue |
|---|---|
| Palette incompatible | Sélectionner les pixels ou pièces concernés. |
| Trop de sprites sur une ligne | Surligner cette ligne et les objets qui contribuent au dépassement. |
| Ressources trop volumineuses | Montrer leur répartition et les principaux consommateurs. |
| Conflit de palette | Montrer les ressources concurrentes dans la scène. |
| Transfert d’animation trop important | Identifier la transition concernée et les données modifiées. |
| Référence manquante | Aller directement à l’élément à réparer. |

Trois états suffisent :

- **Erreur certaine**.
- **Risque dépendant du jeu**.
- **Suggestion d’optimisation**.

L’estimation des transferts indique ses hypothèses. L’éditeur calcule le coût des ressources qu’il connaît ; le temps disponible dépend aussi du programme du jeu.

L’édition et la sauvegarde restent possibles en présence d’erreurs. L’export destiné à la console explique précisément les incompatibilités restantes.

## 11. Import et réimport

### 11.1. Formats et conversion

Le premier format d’import est le PNG, avec préservation des indices lorsque l’image est indexée. Les feuilles de sprites permettent un découpage par grille et une association aux animations.

Une intégration Aseprite permettrait de conserver les images, les durées et les noms d’animations en s’appuyant sur son [format documenté](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md).

Pour une image incompatible avec la destination, l’import propose :

- La palette de destination.
- Les couleurs à préserver.
- La réduction des couleurs.
- Le tramage éventuel.
- Le découpage.
- La comparaison avant/après.

Aucune réduction de couleurs ne doit être silencieuse. L’import reste prévisible et réversible.

### 11.2. Mise à jour des sources

Le réimport permet de remplacer un dessin source en conservant les noms, points d’origine et assemblages lorsque cela est possible. Les correspondances incertaines sont présentées à l’utilisateur.

## 12. Export et intégration au jeu

L’export fait partie du produit dès la première version.

Les sorties essentielles sont les données de tiles, palettes et tilemaps. Les assemblages, animations et métadonnées demandent des formats documentés, adaptés au programme qui les consomme.

Des outils existants comme SuperFamiconv illustrent les opérations de conversion, remappage et déduplication à prendre en compte. Ils constituent une référence fonctionnelle pour définir des exports maîtrisables. Voir la [documentation SuperFamiconv](https://github.com/Optiroc/SuperFamiconv).

Un ensemble d’export définit :

- Les ressources incluses.
- Le format et les noms des fichiers.
- L’ordre des données et les emplacements réservés.
- Les symboles utilisables dans le code.
- Les optimisations autorisées.
- Les conventions d’animation et d’assemblage.

Les palettes nommées et les variantes doivent rester identifiables dans les données ou symboles fournis au jeu. Le format choisi explique comment sélectionner une autre palette pour des graphismes partagés.

À projet et réglages identiques, les données exportées sont identiques. Ajouter une ressource sans rapport ne doit pas réorganiser arbitrairement un export existant.

Un premier export assembleur ca65 est proposé pour le contexte de développement SNES évoqué. Il s’agit d’une cible fonctionnelle ; la présence des outils locaux n’a pas été vérifiée pour cette analyse.

Un export depuis la ligne de commande permet l’intégration à la compilation du jeu, avec les mêmes résultats que depuis l’interface.

## 13. Optimisation

L’éditeur peut rechercher :

- Les tiles identiques.
- Les doublons réutilisables par retournement lorsque la destination le permet.
- Les ressources inutilisées.
- Les couleurs redondantes.
- Les données communes entre poses.
- Les organisations de données qui réduisent les transferts.

Chaque opération présente le gain, les éléments concernés et ses conséquences.

Fusionner deux tiles actuellement identiques ne signifie pas forcément que l’auteur souhaite les modifier ensemble à l’avenir. Deux opérations sont donc distinguées :

- **Fusion des ressources du projet**, qui change leur relation pendant l’édition.
- **Déduplication des données exportées**, qui réduit les fichiers en conservant l’indépendance des ressources sources.

L’optimisation doit préserver l’intention de l’auteur et une édition prévisible.

## 14. Interface et confort d’utilisation

L’interface suit l’objet sur lequel l’utilisateur travaille.

| Zone | Utilité |
|---|---|
| À gauche | Bibliothèque des ressources avec recherche et vignettes. |
| Au centre | Dessin, assemblage, carte ou scène. |
| À droite | Propriétés de la sélection. |
| En bas, selon le besoin | Palette ou timeline. |

Les informations matérielles détaillées sont accessibles dans un inspecteur contextuel. Elles apparaissent automatiquement lorsqu’elles expliquent un problème.

Les interactions prioritaires sont :

- Double-cliquer sur une pièce pour modifier son dessin.
- Revenir immédiatement à l’assemblage.
- Rechercher tous les usages d’une ressource.
- Remplacer une ressource dans une sélection ou tout le projet.
- Choisir une palette nommée pour la sélection et voir immédiatement le résultat.
- Créer une variante à partir de la ressource courante.
- Comparer deux variantes côte à côte.
- Annuler une opération globale en une seule fois.

L’historique, la sauvegarde automatique et la récupération après fermeture inattendue sont prioritaires. L’utilisateur doit pouvoir expérimenter sans craindre de perdre son travail.

Les composants et informations sans utilité pour la tâche courante sont omis. L’interface ne doit pas devenir un tableau de démonstration technique.

## 15. Vérification du rendu exporté

L’aperçu intégré utilise les données produites par l’export autant que possible, pour éviter un rendu correct dans l’éditeur qui ne correspondrait pas aux fichiers livrés au jeu.

À terme, une commande peut générer une petite ROM de démonstration contenant la scène et l’ouvrir dans un émulateur configuré.

Les résultats sont clairement distingués :

- Aperçu de l’éditeur.
- Vérification dans l’émulateur.
- Observation sur console réelle.

Une ROM de démonstration vérifie les ressources dans son propre contexte. Elle ne garantit pas les performances du jeu complet.

## 16. Ordre de réalisation

Décision de réalisation : les trois ensembles ci-dessous appartiennent au périmètre visé pour la V1. Ils décrivent l'ordre du travail interne, sans réduire la première version au seul premier ensemble. L'application vise Linux et Windows avec Tauri 2, TypeScript, React et Canvas 2D ; les projets sont des fichiers autonomes et l'interface propose le français et l'anglais. L'état réellement implémenté et vérifié est suivi dans [status.md](status.md).

| Étape | Contenu | Résultat concret |
|---|---|---|
| **Créer et exporter** | Projet, palettes nommées, changement de palette et variantes simples, dessin de tiles, assemblage de métasprites, animations simples, tilemap simple, exports documentés. | Produire un personnage animé avec des variantes de tenue et un décor intégrables à un jeu. |
| **Composer et maîtriser** | Scènes, ressources partagées, métatiles, réimport, diagnostics, occupation mémoire et optimisation. | Préparer un ensemble graphique cohérent et corriger ses problèmes en contexte. |
| **Exploiter toute la console** | Couverture avancée des modes, Mode 7, effets par ligne, opérations de couleur, scénarios de chargement et ROM de démonstration. | Concevoir des scènes complexes avec leurs données et leurs contraintes d’intégration. |

La gestion des palettes nommées et des variantes simples appartient au socle fonctionnel.

## 17. Parcours de référence

La qualité du produit se juge sur quelques parcours complets :

1. Recolorer un personnage en sélectionnant une palette nommée, sans modifier son dessin ni ses animations.
2. Créer les variantes « domicile » et « extérieur » d’un joueur de football, partager leurs graphismes et les afficher ensemble dans une scène.
3. Dupliquer une palette, changer les couleurs du maillot et conserver les couleurs de peau et de contour.
4. Modifier une palette partagée et observer la mise à jour de ses utilisateurs, sans affecter ceux d’une autre palette.
5. Corriger une tile et retrouver tous les endroits affectés.
6. Importer une nouvelle version d’un personnage sans reconstruire ses assemblages lorsque les correspondances sont conservées.
7. Composer plusieurs ennemis et localiser les dépassements d’affichage.
8. Exporter une scène puis retrouver son rendu dans une ROM de démonstration.

Ces parcours servent à vérifier le comportement utile du produit avec des contrôles ciblés, sans multiplier les procédures ou les tests redondants.
