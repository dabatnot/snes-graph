import { useState } from "react";
import { clone, type Project, type Sheet } from "../core/model";
import {
  resizePositions,
  transformSheet,
  exchangeTileBlocks,
  resourceUses,
} from "../core/resources";
import { renderSheet } from "../core/render";
import { Check, NumberField, Select, Preview } from "./controls";
import { tr } from "../i18n";

export function SheetLayout({
  open,
  setOpen,
  project,
  sheet,
  selection,
  change,
  onApplied,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  project: Project;
  sheet: Sheet;
  selection: { x: number; y: number; width: number; height: number } | null;
  change: (fn: (p: Project) => void) => void;
  onApplied: () => void;
}) {
  const [width, setWidth] = useState(sheet.width / 8),
    [height, setHeight] = useState(sheet.height / 8),
    [anchor, setAnchor] = useState("0"),
    [mode, setMode] = useState("resize"),
    [x, setX] = useState(0),
    [y, setY] = useState(0),
    [replacements, setReplacements] = useState<Record<number, number>>({}),
    [lossAccepted, setLoss] = useState(false);
  if (!open)
    return (
      <button
        onClick={() => {
          setWidth(sheet.width / 8);
          setHeight(sheet.height / 8);
          setReplacements({});
          setLoss(false);
          setOpen(true);
        }}
      >
        {tr("Dimensions et organisation…", "Size and arrangement…")}
      </button>
    );
  const region = selection
    ? {
        x: Math.floor(selection.x / 8),
        y: Math.floor(selection.y / 8),
        width:
          Math.ceil((selection.x + selection.width) / 8) -
          Math.floor(selection.x / 8),
        height:
          Math.ceil((selection.y + selection.height) / 8) -
          Math.floor(selection.y / 8),
      }
    : { x: 0, y: 0, width: sheet.width / 8, height: sheet.height / 8 };
  let positions: number[] = [],
    w = width * 8,
    h = height * 8,
    error = "",
    preview: Project | undefined;
  try {
    if (mode === "crop") {
      w = region.width * 8;
      h = region.height * 8;
      positions = resizePositions(
        sheet.width,
        sheet.height,
        w,
        h,
        -region.x,
        -region.y,
      );
    } else if (mode === "exchange") {
      w = sheet.width;
      h = sheet.height;
      positions = exchangeTileBlocks(w / 8, h / 8, region, x, y);
    } else if (
      ["insertRow", "removeRow", "insertColumn", "removeColumn"].includes(mode)
    ) {
      const vertical = mode.endsWith("Row"),
        insert = mode.startsWith("insert"),
        line = vertical ? y : x;
      const cols = sheet.width / 8,
        rows = sheet.height / 8;
      if (
        line >= (vertical ? rows : cols) ||
        (!insert && (vertical ? rows : cols) === 1)
      )
        throw new Error(
          tr("Ligne ou colonne invalide", "Invalid row or column"),
        );
      w = sheet.width + (vertical ? 0 : insert ? 8 : -8);
      h = sheet.height + (vertical ? (insert ? 8 : -8) : 0);
      positions = Array.from({ length: cols * rows }, (_, i) => {
        let tx = i % cols,
          ty = Math.floor(i / cols);
        const value = vertical ? ty : tx;
        if (!insert && value === line) return -1;
        const offset = value >= line ? (insert ? 1 : -1) : 0;
        if (vertical) ty += offset;
        else tx += offset;
        return (ty * w) / 8 + tx;
      });
    } else {
      const a = Number(anchor);
      positions = resizePositions(
        sheet.width,
        sheet.height,
        w,
        h,
        Math.floor(((width - sheet.width / 8) * (a % 3)) / 2),
        Math.floor(((height - sheet.height / 8) * Math.floor(a / 3)) / 2),
      );
    }
    preview = clone(project);
    transformSheet(preview, sheet.id, w, h, positions, replacements);
  } catch (e) {
    error = String(e);
    preview = undefined;
  }
  const removed = positions.flatMap((dest, i) => (dest < 0 ? [i] : []));
  const affected = resourceUses(project, sheet.id);
  return (
    <div className="modal-shade">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={tr("Dimensions et organisation", "Size and arrangement")}
      >
        <h2>{tr("Dimensions et organisation", "Size and arrangement")}</h2>
        <Select
          label={tr("Opération", "Operation")}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setLoss(false);
            setReplacements({});
          }}
          options={[
            { value: "resize", label: tr("Redimensionner", "Resize") },
            {
              value: "crop",
              label: tr("Recadrer sur la sélection", "Crop to selection"),
            },
            {
              value: "exchange",
              label: tr(
                "Déplacer / échanger la sélection de tiles",
                "Move / exchange selected tiles",
              ),
            },
            ...[
              ["insertRow", tr("Insérer une ligne", "Insert row")],
              ["removeRow", tr("Retirer une ligne", "Remove row")],
              ["insertColumn", tr("Insérer une colonne", "Insert column")],
              ["removeColumn", tr("Retirer une colonne", "Remove column")],
            ].map(([value, label]) => ({ value, label })),
          ]}
        />
        {mode === "resize" && (
          <>
            <div className="number-row">
              <NumberField
                label={tr("Colonnes de tiles", "Tile columns")}
                min={1}
                max={512}
                value={width}
                onChange={(v) => {
                  setWidth(v);
                  setLoss(false);
                }}
              />
              <NumberField
                label={tr("Lignes de tiles", "Tile rows")}
                min={1}
                max={512}
                value={height}
                onChange={(v) => {
                  setHeight(v);
                  setLoss(false);
                }}
              />
            </div>
            <Select
              label={tr("Ancrage", "Anchor")}
              value={anchor}
              onChange={(v) => {
                setAnchor(v);
                setLoss(false);
              }}
              options={[
                tr("Haut gauche", "Top left"),
                tr("Haut centre", "Top centre"),
                tr("Haut droite", "Top right"),
                tr("Milieu gauche", "Middle left"),
                tr("Centre", "Centre"),
                tr("Milieu droite", "Middle right"),
                tr("Bas gauche", "Bottom left"),
                tr("Bas centre", "Bottom centre"),
                tr("Bas droite", "Bottom right"),
              ].map((label, value) => ({ label, value: String(value) }))}
            />
          </>
        )}
        {mode.endsWith("Row") && (
          <NumberField
            label={tr("Ligne (à partir de 0)", "Row (from 0)")}
            min={0}
            max={sheet.height / 8 - 1}
            value={y}
            onChange={setY}
          />
        )}
        {mode.endsWith("Column") && (
          <NumberField
            label={tr("Colonne (à partir de 0)", "Column (from 0)")}
            min={0}
            max={sheet.width / 8 - 1}
            value={x}
            onChange={setX}
          />
        )}
        {mode === "exchange" && (
          <>
            <p>
              {tr(
                "Sélectionnez un bloc dans le dessin avant d’ouvrir ce dialogue. La destination échange ses tiles avec la sélection.",
                "Select a block in the drawing before opening this dialog. Destination tiles are exchanged with the selection.",
              )}
            </p>
            <div className="number-row">
              <NumberField
                label="X"
                min={0}
                max={sheet.width / 8 - 1}
                value={x}
                onChange={setX}
              />
              <NumberField
                label="Y"
                min={0}
                max={sheet.height / 8 - 1}
                value={y}
                onChange={setY}
              />
            </div>
          </>
        )}
        <p>
          {w} × {h} pixels · {(w * h) / 64} tiles
        </p>
        {affected.length > 0 && (
          <p>
            {tr("Usages partagés : ", "Shared uses: ")}
            {affected.map((u) => u.name).join(", ")}
          </p>
        )}
        {removed.length > 0 && (
          <>
            <p>
              {tr("Tiles retirées : ", "Removed tiles: ")}
              {removed.join(", ")}
            </p>
            <details>
              <summary>
                {tr(
                  "Remplacer les références aux tiles retirées",
                  "Replace references to removed tiles",
                )}
              </summary>
              <p>
                {tr(
                  "Numéros de destination dans le nouveau dessin. Les pixels supprimés ne sont pas recopiés.",
                  "Destination indices in the new drawing. Removed pixels are not copied.",
                )}
              </p>
              {removed.map((tile) => (
                <label className="field" key={tile}>
                  <span>Tile {tile}</span>
                  <input
                    type="number"
                    min={0}
                    max={(w * h) / 64 - 1}
                    value={replacements[tile] ?? ""}
                    onChange={(e) => {
                      const n = e.currentTarget.valueAsNumber;
                      setReplacements((r) => {
                        const next = { ...r };
                        if (Number.isInteger(n)) next[tile] = n;
                        else delete next[tile];
                        return next;
                      });
                    }}
                  />
                </label>
              ))}
            </details>
            <Check
              label={tr(
                "J’accepte la suppression des pixels hors du nouveau dessin",
                "I accept deleting pixels outside the new drawing",
              )}
              value={lossAccepted}
              onChange={setLoss}
            />
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {preview && (
          <Preview
            image={renderSheet(
              preview,
              preview.sheets.find((s) => s.id === sheet.id)!,
            )}
            scale={Math.min(4, 400 / Math.max(w, h))}
          />
        )}
        <div className="button-row">
          <button onClick={() => setOpen(false)}>
            {tr("Annuler", "Cancel")}
          </button>
          <button
            disabled={!preview || (removed.length > 0 && !lossAccepted)}
            onClick={() => {
              change((p) =>
                transformSheet(p, sheet.id, w, h, positions, replacements),
              );
              onApplied();
              setOpen(false);
            }}
          >
            {tr("Appliquer", "Apply")}
          </button>
        </div>
      </section>
    </div>
  );
}
