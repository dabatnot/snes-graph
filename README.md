# SNES Graph

Éditeur graphique SNES pour Linux et Windows, construit avec Tauri 2, React, TypeScript et Canvas 2D. Les projets restent locaux dans un fichier `.snesgraph`.

Manuel utilisateur illustré : [Français](docs/guide/index.html) · [English](docs/guide/en.html). Les deux éditions se consultent hors ligne et proposent un sélecteur de langue.

## Démarrer

Avec Node.js 24 et npm :

```sh
npm ci
npm run dev
```

Ouvrir <http://127.0.0.1:1420>. Cette version navigateur permet d'éditer et télécharger les projets, les exports et les sources ca65. L'application de bureau ajoute les dialogues natifs, l'écriture atomique, l'ouverture de fichiers associés et l'exécution de ca65/Mesen.

Avec Rust stable et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/) :

```sh
npm run desktop
```

Sous Fedora, les dépendances de développement principales sont `webkit2gtk4.1-devel`, `gtk3-devel`, `openssl-devel`, `librsvg2-devel`, `libappindicator-gtk3-devel`, `patchelf` et les outils C/C++. Sous Windows, installer les outils C++ MSVC et WebView2 décrits par Tauri.

```sh
npm run bundle:linux      # RPM et AppImage, à exécuter sous Linux
npm run bundle:windows    # installateur NSIS, à exécuter sous Windows
```

Les paquets sont produits dans `src-tauri/target/release/bundle`. Le workflow GitHub Actions construit les deux plateformes ; sa présence ne signifie pas qu'une exécution Windows a déjà réussi.

Après compilation, lancer directement l'application depuis la racine du projet :

```sh
./src-tauri/target/release/snes-graph
```

Sous Linux, le binaire désactive par défaut le rendu DMA-BUF de WebKit et utilise une sélection de polices système courantes (Liberation, DejaVu, Symbola lorsqu'elles sont installées). Cela contourne les deux problèmes observés sous Fedora : une boucle dans Fontconfig et une erreur de protocole Wayland laissant une fenêtre vide. Aucun réglage système n'est modifié. Les variables `FONTCONFIG_FILE` et `WEBKIT_DISABLE_DMABUF_RENDERER`, si elles sont déjà définies, restent prioritaires. La sélection de polices peut limiter certains caractères ; pour utiliser toute la collection système, définir `FONTCONFIG_FILE=/etc/fonts/fonts.conf`. Le contournement graphique est décrit dans la [documentation Tauri](https://v2.tauri.app/develop/debug/linux-graphics/).

Le script Linux conserve les symboles des bibliothèques embarquées (`NO_STRIP=1`) pour éviter l'incompatibilité du `strip` fourni par linuxdeploy avec les sections `.relr.dyn` des bibliothèques Fedora récentes. Ce réglage est [pris en charge par linuxdeploy](https://github.com/linuxdeploy/linuxdeploy/issues/72).

## Utiliser l'éditeur

- **Dessins** : pixels indexés, crayon, gomme, formes, remplissage, sélection, lasso, déplacement, symétrie, calques, raccords, PNG et Aseprite.
- **Palettes** : noms, couleurs SNES, noms des entrées, verrouillage, duplication, dégradé, réordonnancement avec remappage et cycles.
- **Sprites** : assemblage de pièces, déplacements et groupes, poses, animations, événements, collisions, attaches et variantes de palettes.
- **Cartes** : peinture, remplissage, palettes et attributs, métatiles capturées depuis une sélection, raccords automatiques et tiles animées.
- **Scènes** : modes 0 à 7, couches, caméra, instances, tailles OBJ, priorités, mélanges de couleurs, mosaïque et effets par ligne.
- **Exporter** : ensembles enregistrés, déduplication, données SNES et métadonnées documentées, mémoire de scène et ROM de démonstration.

Une palette de sprite comporte **16 entrées : la transparence à l'indice 0 et 15 couleurs visibles**. Les variantes partagent les dessins et les animations. Le bouton **Ouvrir l'exemple football** présente les variantes Domicile et Extérieur ensemble.

`Ctrl+S` enregistre, `Ctrl+Shift+S` enregistre sous, `Ctrl+O` ouvre, `Ctrl+Z` annule et `Ctrl+Shift+Z` rétablit. Un double-clic sur une pièce ouvre son dessin ; **Revenir au personnage** retrouve l'assemblage. Les ressources référencées ne sont pas supprimées tant que leurs usages n'ont pas été remplacés.

Le dossier `examples` contient trois projets ouvrables avec **Ouvrir** : `football.snesgraph`, `mode7.snesgraph` (rotation et perspective) et `hdma.snesgraph` (dégradé, vague et iris).

## Export en ligne de commande

```sh
npm run example
npm run export -- examples/football.snesgraph artifacts/football --scene Match
npm run export -- examples/football.snesgraph artifacts/football --scene Match --rom
npm run export -- mon-projet.snesgraph sortie --set "Export principal"
npm run export -- examples/football.snesgraph artifacts/gallery --gallery --rom
npm run export -- examples/football.snesgraph artifacts/gallery-en --gallery --language en
```

`--rom` utilise `ca65` et `ld65` présents dans le PATH. Dans l'application native, leurs chemins et celui de l'émulateur sont configurables dans l'atelier Exporter. Deux modes sont disponibles : une scène en boucle et une galerie interactive des personnages, cartes et scènes sélectionnés. La galerie se parcourt à la manette (port 1), inclut automatiquement les dépendances et fait défiler les grandes cartes. Elle ne fournit pas de logique de jeu. `--gallery` écrit les sources et `--gallery --rom` construit `gallery.sfc` ; cette option ne se combine pas avec `--scene`. Les menus suivent `--language fr|en` (français par défaut).

Le CLI et le worker partagent les générateurs `exportProject`, `demoSources` et `gallerySources` selon le mode demandé. Les chemins des ressources reposent sur des identifiants stables ; les noms lisibles et les correspondances restent dans `manifest.json`.

## Vérifications et documentation

```sh
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

- [Formats des projets et exports](docs/formats.md)
- [Périmètre, vérifications et limites](docs/status.md)
- [Vision fonctionnelle](docs/specs.md)

Le rendu de travail est un aperçu. La ROM permet une vérification distincte dans l'émulateur ; aucune validation sur console réelle n'est revendiquée.

## Organisation

`src/core` contient les données, codecs, importateurs, rendus et exports sans dépendance à React ou Tauri. `src/ui` contient les ateliers. `src/App.tsx` gère le projet, l'historique et la navigation. `src/platform.ts` regroupe les entrées/sorties. Le petit hôte Rust de `src-tauri` gère les fichiers et les processus natifs.

Les ressources de l'exemple football et l'icône ont été créées pour ce projet ; aucune ressource de jeu commercial n'est fournie.

Exemples ca65 autonomes : `npm run examples:integration` (cc65 requis), voir
[la recette bilingue](examples/integration/README.md). Mesures reproductibles :
`npm run benchmark`, résultats dans `artifacts/benchmark.json`.
