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
export function releaseMarkdown(language: "fr" | "en") {
  const labels =
    language === "fr"
      ? { added: "Ajouts", improved: "Améliorations", fixed: "Corrections" }
      : { added: "Added", improved: "Improved", fixed: "Fixed" };
  return releases
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
        `\nCommits: ${r.commits.join(", ")}\n`
      );
    })
    .join("\n");
}
