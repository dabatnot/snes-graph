import { useMemo, useState } from "react";
import {
  clone,
  type Project,
  type Tilemap,
  type Cell,
  type Sheet,
} from "../core/model";
import {
  captureMap,
  pasteMap,
  type MapClip,
  type Region,
} from "../core/map-edit";
import { renderMap } from "../core/render";
import { Check, NumberField, Select, Preview } from "./controls";
import { tr } from "../i18n";
export function MapRegion({
  project,
  map,
  region,
  fill,
  change,
}: {
  project: Project;
  map: Tilemap;
  region: Region;
  fill: Cell;
  change: (fn: (p: Project) => void) => void;
}) {
  const [captured, setCaptured] = useState<{
      clip: MapClip;
      sheet: Sheet;
    } | null>(null),
    [x, setX] = useState(0),
    [y, setY] = useState(0),
    [operation, setOperation] = useState<"copy" | "flipX" | "flipY" | "rotate">(
      "copy",
    ),
    [grow, setGrow] = useState(false),
    [move, setMove] = useState(false),
    [source, setSource] = useState<Region>(region),
    [result, setResult] = useState<{
      project: Project;
      addedTiles: number;
      original: Project;
    } | null>(null),
    [error, setError] = useState("");
  const sheet = project.sheets.find((s) => s.id === map.sheetId)!;
  // Project edits clone every resource; compare the actual source, not identity.
  const clip = useMemo(() => {
    if (!captured) return null;
    const before = captured.sheet;
    return before.id === sheet.id &&
      before.width === sheet.width &&
      before.height === sheet.height &&
      before.bpp === sheet.bpp &&
      before.pixels.every((pixel, i) => pixel === sheet.pixels[i]) &&
      (before.layers?.length ?? 0) === (sheet.layers?.length ?? 0) &&
      (before.layers ?? []).every((layer, i) => {
        const current = sheet.layers![i];
        return (
          layer.id === current.id &&
          layer.visible === current.visible &&
          layer.pixels.every((pixel, j) => pixel === current.pixels[j])
        );
      }) &&
      JSON.stringify(captured.clip.animations) ===
        JSON.stringify(map.animatedTiles)
      ? captured.clip
      : null;
  }, [captured, sheet, map.animatedTiles]);
  const clear = () => {
    setResult(null);
    setError("");
  };
  return (
    <details>
      <summary>
        {tr("Copier et transformer une région", "Copy and transform a region")}
      </summary>
      <button
        onClick={() => {
          setCaptured({ clip: captureMap(project, map.id, region), sheet });
          setSource({ ...region });
          setX(region.x);
          setY(region.y);
          clear();
        }}
      >
        {tr("Copier la région sélectionnée", "Copy selected region")} (
        {region.width} × {region.height})
      </button>
      {captured && !clip && (
        <p>
          {tr(
            "Le dessin source ou ses animations ont changé. Recopiez la région avant de coller.",
            "The source drawing or its animations changed. Copy the region again before pasting.",
          )}
        </p>
      )}
      {clip && (
        <>
          <Select
            label={tr("Transformation", "Transformation")}
            value={operation}
            options={[
              { value: "copy", label: tr("Aucune", "None") },
              {
                value: "flipX",
                label: tr("Miroir horizontal", "Horizontal flip"),
              },
              { value: "flipY", label: tr("Miroir vertical", "Vertical flip") },
              {
                value: "rotate",
                label: tr("Rotation 90° horaire", "Rotate 90° clockwise"),
              },
            ]}
            onChange={(v) => {
              setOperation(v as typeof operation);
              clear();
            }}
          />
          <div className="number-row">
            <NumberField
              label="X"
              min={0}
              max={511}
              value={x}
              onChange={(v) => {
                setX(v);
                clear();
              }}
            />
            <NumberField
              label="Y"
              min={0}
              max={511}
              value={y}
              onChange={(v) => {
                setY(v);
                clear();
              }}
            />
          </div>
          <Check
            label={tr(
              "Agrandir la carte si nécessaire",
              "Enlarge map if needed",
            )}
            value={grow}
            onChange={(v) => {
              setGrow(v);
              clear();
            }}
          />
          <Check
            label={tr(
              "Déplacer : remplir la source avec le pinceau courant",
              "Move: fill source with current brush",
            )}
            value={move}
            onChange={(v) => {
              setMove(v);
              clear();
            }}
          />
          <p>
            {tr(
              "Les associations de terrain sont retirées des cellules transformées. Les autres attributs sont conservés.",
              "Terrain associations are removed from transformed cells. Other attributes are preserved.",
            )}
          </p>
          <button
            onClick={() => {
              try {
                const preview = clone(project),
                  info = pasteMap(
                    preview,
                    map.id,
                    clip,
                    x,
                    y,
                    operation,
                    grow,
                    move ? { region: source, fill } : undefined,
                  );
                setResult({
                  project: preview,
                  addedTiles: info.addedTiles,
                  original: project,
                });
                setError("");
              } catch (e) {
                setResult(null);
                setError(String(e));
              }
            }}
          >
            {tr("Prévisualiser", "Preview")}
          </button>
          {error && <p className="error">{error}</p>}
          {result && result.original === project && (
            <>
              <p>
                {result.addedTiles}{" "}
                {tr(
                  "nouvelles tiles ; aperçu avant application",
                  "new tiles; preview before applying",
                )}
              </p>
              <Preview
                image={renderMap(result.project, map.id)}
                scale={Math.min(1, 200 / Math.max(map.width, map.height) / 8)}
              />
              <button
                onClick={() => {
                  change((p) => {
                    pasteMap(
                      p,
                      map.id,
                      clip,
                      x,
                      y,
                      operation,
                      grow,
                      move ? { region: source, fill } : undefined,
                    );
                  });
                  clear();
                }}
              >
                {tr("Appliquer le collage", "Apply paste")}
              </button>
            </>
          )}
        </>
      )}
    </details>
  );
}
