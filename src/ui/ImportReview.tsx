import type { Project, Sheet } from "../core/model";
import type { importPng } from "../core/import";
import { changedTiles } from "../core/import-review";
import { resourceUses } from "../core/resources";
import { tr } from "../i18n";
export function ImportReview({
  project,
  result,
  current,
}: {
  project: Project;
  result: ReturnType<typeof importPng>;
  current?: Sheet;
}) {
  const compatible =
    current &&
    !current.layers &&
    current.width === result.sheet.width &&
    current.height === result.sheet.height &&
    current.bpp === result.sheet.bpp;
  const tiles = compatible ? changedTiles(current, result.sheet) : [];
  return (
    <>
      <p>
        {tr(
          "Différences : rose = couleur, orange = alpha, violet = marge ajoutée",
          "Differences: pink = color, orange = alpha, purple = added padding",
        )}
      </p>
      <p>
        {result.original.width} × {result.original.height} →{" "}
        {result.sheet.width} × {result.sheet.height} · {result.alphaChanged}{" "}
        {tr("pixels avec alpha ajusté", "pixels with adjusted alpha")} ·{" "}
        {result.padding}{" "}
        {tr("pixels de marge transparente", "transparent padding pixels")}
      </p>
      {current && (
        <>
          <h3>
            {tr("Réimport du dessin", "Reimport drawing")} : {current.name}
          </h3>
          <p>
            {tr(
              "La palette du dessin est conservée. Seuls les indices de pixels et le nom du fichier source sont remplacés ; les poses et animations Aseprite ne sont pas mises à jour.",
              "The drawing palette is retained. Only pixel indices and the source filename are replaced; Aseprite poses and animations are not updated.",
            )}
          </p>
          {compatible ? (
            <p>
              {tiles.length} {tr("tiles modifiées", "changed tiles")} :{" "}
              {tiles.length ? tiles.join(", ") : tr("aucune", "none")}
            </p>
          ) : (
            <p className="error">
              {tr(
                "Le réimport exige les mêmes dimensions et la même profondeur, sans calques. Importez comme nouveau dessin ou préparez le dessin existant.",
                "Reimport requires the same dimensions and depth, without layers. Import as new graphics or prepare the existing drawing.",
              )}
            </p>
          )}
          <p>
            {tr(
              "Usages du dessin à vérifier après remplacement :",
              "Drawing uses to check after replacement:",
            )}
          </p>
          <ul>
            {resourceUses(project, current.id).map((u) => (
              <li key={u.id}>{u.name}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
