import { useState } from "react";
import { clone, type Project, type Tilemap, type Cell } from "../core/model";
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
  const [clip, setClip] = useState<MapClip | null>(null),
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
          setClip(captureMap(project, map.id, region));
          setSource({ ...region });
          setX(region.x);
          setY(region.y);
          clear();
        }}
      >
        {tr("Copier la région sélectionnée", "Copy selected region")} (
        {region.width} × {region.height})
      </button>
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
