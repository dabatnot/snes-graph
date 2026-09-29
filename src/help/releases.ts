export type ReleaseNote = {
  version?: string;
  date: string;
  commits: string[];
  fr: {
    title: string;
    summary: string;
    added?: string[];
    improved?: string[];
    fixed?: string[];
  };
  en: {
    title: string;
    summary: string;
    added?: string[];
    improved?: string[];
    fixed?: string[];
  };
};
export const releases: ReleaseNote[] = [
  {
    version: "0.2.5",
    date: "2026-09-29",
    commits: ["767aa5d", "5c6414c"],
    en: {
      title: "Stable drawing views and preview backgrounds",
      summary:
        "Keep your framing across drawings and check artwork against neutral or custom SNES-color backgrounds.",
      added: [
        "Checkerboard, white, black, 50% gray and custom RGB555 preview backgrounds, cycled with Shift+B.",
        "Custom background color picker and 5-bit red, green and blue controls (0–31), independent of project palettes and exports.",
        "H toggles the reference image without moving the canvas.",
      ],
      improved: [
        "Zoom and view position are shared across drawings during the session.",
        "English and French manuals include the new controls and screenshots.",
      ],
      fixed: [
        "Hiding a reference preserves the workspace bounds and framing.",
        "Large drawings no longer limit zoom on smaller drawings; the requested zoom is retained across temporary canvas-size limits.",
      ],
    },
    fr: {
      title: "Cadrage stable et fonds d’aperçu",
      summary:
        "Conservez le cadrage entre dessins et vérifiez vos créations sur des fonds neutres ou une couleur SNES personnalisée.",
      added: [
        "Fonds d’aperçu damier, blanc, noir, gris 50 % et RVB 5 bits personnalisé, accessibles avec Maj+B.",
        "Sélecteur de couleur et composantes rouge, verte et bleue sur 5 bits (0–31), indépendants des palettes du projet et des exports.",
        "H affiche ou masque la référence sans déplacer le canevas.",
      ],
      improved: [
        "Zoom et position de la vue partagés entre les dessins pendant la session.",
        "Manuels français et anglais complétés avec les commandes et captures correspondantes.",
      ],
      fixed: [
        "Masquer une référence conserve les limites de l’espace de travail et le cadrage.",
        "Un grand dessin ne limite plus le zoom des petits dessins ; le zoom demandé est conservé malgré les limites temporaires du canevas.",
      ],
    },
  },
  {
    version: "0.2.4",
    date: "2026-09-27",
    commits: [],
    en: {
      title: "Drawing references, gestures and keyboard shortcuts",
      summary:
        "Draw with an embedded reference image and navigate, choose colors and edit selections directly from the keyboard.",
      added: [
        "Reference images saved inside projects, with position, size, opacity and visibility controls; references remain separate from exported artwork.",
        "Pointer-centered Ctrl+wheel zoom, keyboard zoom, Shift+F framing, Space-drag and middle-button panning.",
        "Direct palette keys 0–9 and A–F, including the unshifted AZERTY number row and numeric keypad; tool shortcuts and temporary Ctrl-click color picking.",
        "Selection copy, cut, paste and deletion; arrow-key movement by 1 or 8 pixels, with a held key forming one undo step.",
        "Shift-constrained lines, squares and circles, plus Escape to cancel a gesture.",
      ],
      improved: [
        "English and French manuals and tooltips document drawing gestures, shortcut scope and palette limits.",
        "Drawing previews avoid copying embedded reference images on every pointer update.",
      ],
      fixed: [
        "Keyboard moves cannot overwrite another layer when the active layer changes, and canvas clicks no longer finish them prematurely.",
        "Drawing and undo shortcuts stay inactive behind the Size and arrangement dialog.",
        "Lasso masks are preserved during copying and movement; locked layers remain protected from edits.",
      ],
    },
    fr: {
      title: "Références de dessin, gestes et raccourcis clavier",
      summary:
        "Dessinez avec une image de référence intégrée et utilisez le clavier pour naviguer, choisir les couleurs et modifier les sélections.",
      added: [
        "Images de référence enregistrées dans les projets, avec réglage de position, taille, opacité et visibilité ; elles restent séparées des dessins exportés.",
        "Zoom Ctrl+roulette centré sur le pointeur, zoom clavier, cadrage Maj+F et déplacement de vue avec Espace+glisser ou le bouton central.",
        "Couleurs accessibles par 0–9 et A–F, y compris la rangée numérique AZERTY sans Maj et le pavé numérique ; raccourcis d’outils et pipette temporaire par Ctrl+clic.",
        "Copie, coupe, collage et effacement de sélection ; déplacement par flèches de 1 ou 8 pixels, avec une seule annulation par pression prolongée.",
        "Contraintes Maj pour les lignes, carrés et cercles, et Échap pour annuler un geste.",
      ],
      improved: [
        "Manuels français et anglais et infobulles détaillant les gestes, la portée des raccourcis et les limites des palettes.",
        "Les aperçus de dessin évitent de recopier l’image de référence à chaque mouvement du pointeur.",
      ],
      fixed: [
        "Un déplacement clavier ne peut plus écraser un autre calque lors d’un changement de calque ; un clic dans le dessin ne le termine plus prématurément.",
        "Les raccourcis de dessin et d’annulation restent inactifs derrière la fenêtre Dimensions et organisation.",
        "Conservation du masque du lasso pendant la copie et le déplacement ; protection des calques verrouillés contre les modifications.",
      ],
    },
  },
  {
    version: "0.2.3",
    date: "2026-09-27",
    commits: [],
    en: {
      title: "SNES-style ROM gallery",
      summary:
        "A blue and ivory gallery with resource previews, consistent frames and pixel-art controller hints.",
      added: [
        "Project title layout and category previews.",
        "Resource cards for compatible sprites, maps and scenes.",
      ],
      improved: [
        "Shared frame artwork and vertically aligned button labels.",
        "English and French manuals with real emulator captures.",
      ],
      fixed: [
        "Map scrolling across world row zero.",
        "Complete sprite thumbnails regardless of editor origin.",
      ],
    },
    fr: {
      title: "Galerie ROM dans l’esprit SNES",
      summary:
        "Une galerie bleue et ivoire avec aperçus des ressources, cadres cohérents et pictogrammes de manette.",
      added: [
        "Mise en page du titre et aperçus des catégories.",
        "Fiches pour les sprites, cartes et scènes compatibles.",
      ],
      improved: [
        "Cadres communs et alignement vertical des libellés des boutons.",
        "Manuels français et anglais avec captures réelles de l’émulateur.",
      ],
      fixed: [
        "Défilement des cartes au passage de la ligne zéro.",
        "Aperçus complets des sprites indépendamment de leur origine dans l’éditeur.",
      ],
    },
  },
  {
    version: "0.2.2",
    date: "2026-09-27",
    commits: [],
    en: {
      title: "Annotated release tag validation",
      summary:
        "Fix release validation after GitHub Actions checks out an annotated tag.",
      fixed: [
        "Restore the original remote tag object before checking its annotation and commit.",
      ],
    },
    fr: {
      title: "Validation des tags de release annotés",
      summary:
        "Correction de la validation après le checkout d’un tag annoté par GitHub Actions.",
      fixed: [
        "Récupération du tag distant original avant de vérifier son annotation et son commit.",
      ],
    },
  },
  {
    version: "0.2.1",
    date: "2026-09-27",
    commits: [],
    en: {
      title: "English defaults and desktop releases",
      summary:
        "English is now the default language, with French still available. Tagged releases provide Windows, Ubuntu and Fedora packages.",
      added: [
        "Automated release packaging with downloadable installers and SHA-256 checksums.",
      ],
      improved: [
        "English project documentation and default CLI, gallery and help language.",
      ],
    },
    fr: {
      title: "Anglais par défaut et distributions de bureau",
      summary:
        "L’anglais devient la langue par défaut ; le français reste disponible. Les versions taguées proposent des paquets Windows, Ubuntu et Fedora.",
      added: [
        "Distribution automatisée des installateurs avec sommes de contrôle SHA-256.",
      ],
      improved: [
        "Documentation de travail en anglais et langue par défaut du CLI, de la galerie et de l’aide.",
      ],
    },
  },
  {
    version: "0.2.0",
    date: "2026-09-27",
    commits: ["43089ff", "299527f"],
    fr: {
      title: "Galerie ROM et aide intégrée",
      summary:
        "Une version réunissant les évolutions de l’éditeur et une galerie de prévisualisation sur SNES.",
      added: [
        "Galerie ROM à la manette : sprites, animations, variantes, grandes cartes et scènes, avec menus français ou anglais.",
        "Menu Aide : manuel hors ligne dans une fenêtre indépendante, nouveautés, présentation et licences.",
        "Licence MIT pour SNES Graph et le code assembleur fourni par les générateurs.",
      ],
      improved: [
        "Logo SNES Graph dans les ROMs ; texte de prévisualisation limité aux lettres ASCII et aux chiffres.",
        "Renommage du projet depuis son nom dans la barre supérieure, avec annulation.",
        "Version synchronisée entre l’application et ses métadonnées de distribution.",
      ],
    },
    en: {
      title: "ROM gallery and integrated help",
      summary:
        "An update bringing editor improvements together with an SNES preview gallery.",
      added: [
        "Controller-driven ROM gallery: sprites, animations, variants, large maps and scenes, with French or English menus.",
        "Help menu: offline manual in a separate window, release notes, application information and licenses.",
        "MIT licensing for SNES Graph and the assembly program supplied by its generators.",
      ],
      improved: [
        "SNES Graph logo in ROMs; preview text restricted to ASCII letters and digits.",
        "Rename the project from its name in the top bar, with undo support.",
        "Version synchronized across the application and its distribution metadata.",
      ],
    },
  },
  {
    date: "2026-09-27",
    commits: [
      "7d8c7f8",
      "b2bb2c1",
      "de095b3",
      "0cbe90b",
      "4c79854",
      "0c20aca",
      "c167656",
      "8d54478",
      "49f6df0",
      "8da8e3b",
    ],
    fr: {
      title: "Évolutions de l’éditeur — historique reconstitué",
      summary:
        "Travaux retrouvés dans les commits du 27 septembre ; cette entrée ne correspond pas à une ancienne version publiée.",
      added: [
        "Manuel anglais et captures localisées.",
        "Navigation entre ressources et gestion des usages ; redimensionnement et réorganisation des dessins avec conservation des références.",
        "Comparaison des palettes, édition groupée des sprites et des séquences, transformations de régions de cartes.",
        "Analyse mémoire des scènes, comparaison des pertes à l’import et au réimport, exemples d’intégration ca65.",
      ],
      fixed: [
        "Régressions de navigation, d’édition des cartes et d’animation.",
      ],
    },
    en: {
      title: "Editor improvements — reconstructed history",
      summary:
        "Work traced to September 27 commits; this entry does not represent a previously published release.",
      added: [
        "English manual and localized screenshots.",
        "Resource navigation and usage management; drawing resize and rearrangement with preserved references.",
        "Palette comparison, grouped sprite and sequence editing, map-region transformations.",
        "Scene memory analysis, import and reimport loss comparison, ca65 integration examples.",
      ],
      fixed: ["Navigation, map editing and animation regressions."],
    },
  },
  {
    date: "2026-09-26",
    commits: ["9726792", "5dff933"],
    fr: {
      title: "Première base — historique reconstitué",
      summary:
        "Import initial du projet et premières corrections. La base portait le numéro 0.1.0, sans tag local attestant une publication.",
      added: [
        "Ateliers de dessins, palettes, sprites, cartes, scènes et export ; projets autonomes, historique et récupération.",
        "Import PNG/Aseprite, sources ca65, ROM de scène et documentation utilisateur.",
      ],
      fixed: [
        "Édition, import PNG, sauvegardes, références des ressources et exports optimisés.",
      ],
    },
    en: {
      title: "Initial foundation — reconstructed history",
      summary:
        "Initial project import and first fixes. This foundation used version 0.1.0, with no local tag establishing a release.",
      added: [
        "Graphics, palettes, sprites, maps, scenes and export workspaces; self-contained projects, undo and recovery.",
        "PNG/Aseprite import, ca65 sources, scene ROM and user documentation.",
      ],
      fixed: [
        "Editing, PNG import, saves, resource references and optimized exports.",
      ],
    },
  },
];
export function releaseMarkdown(
  language: "fr" | "en" = "en",
  version?: string,
) {
  const selected = version
    ? releases.filter((r) => r.version === version)
    : releases;
  if (!selected.length) throw new Error(`No release notes for ${version}`);
  const labels =
    language === "fr"
      ? { added: "Ajouts", improved: "Améliorations", fixed: "Corrections" }
      : { added: "Added", improved: "Improved", fixed: "Fixed" };
  return selected
    .map((r) => {
      const text = r[language];
      return (
        `## ${r.version ? r.version + " — " : ""}${text.title} (${r.date})\n\n${text.summary}\n` +
        (Object.keys(labels) as (keyof typeof labels)[])
          .filter((k) => text[k]?.length)
          .map(
            (k) =>
              `\n### ${labels[k]}\n\n${text[k]!.map((v) => "- " + v).join("\n")}\n`,
          )
          .join("") +
        (r.commits.length ? `\nCommits: ${r.commits.join(", ")}\n` : "")
      );
    })
    .join("\n");
}
