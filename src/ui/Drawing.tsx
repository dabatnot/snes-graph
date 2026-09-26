import { useEffect, useRef, useState } from "react";
import {
  clone,
  hex,
  uid,
  flattenSheet,
  type Project,
  type Sheet,
} from "../core/model";
import { fill, line, pixel, put, transform, type Point } from "../core/pixels";
import { renderSheet } from "../core/render";
import { growSheet, tileUses } from "../core/resources";
import { SheetLayout } from "./SheetLayout";
import { tr } from "../i18n";
import { Check, Field, NumberField, Select, Preview } from "./controls";
type Tool =
  | "pen"
  | "erase"
  | "fill"
  | "pick"
  | "line"
  | "rect"
  | "ellipse"
  | "select"
  | "lasso"
  | "move";
export function Drawing({
  project,
  sheet,
  change,
  paletteId,
  setPalette,
  focusTile,
}: {
  project: Project;
  sheet: Sheet;
  focusTile?: number;
  change: (fn: (p: Project) => void) => void;
  paletteId: string;
  setPalette: (id: string) => void;
}) {
  const [color, setColor] = useState(1),
    [zoom, setZoom] = useState(
      Math.max(
        1,
        Math.min(10, Math.floor(768 / Math.max(sheet.width, sheet.height))),
      ),
    ),
    [grid, setGrid] = useState(true),
    [sym, setSym] = useState(false),
    [tool, setTool] = useState<Tool>("pen"),
    [selection, setSelection] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(
      focusTile === undefined
        ? null
        : {
            x: (focusTile % (sheet.width / 8)) * 8,
            y: Math.floor(focusTile / (sheet.width / 8)) * 8,
            width: 8,
            height: 8,
          },
    );
  const [layerId, setLayerId] = useState(sheet.layers?.[0]?.id ?? ""),
    [repeat, setRepeat] = useState(false),
    [replaceIndex, setReplaceIndex] = useState(0);
  const layer =
    sheet.layers?.find((l) => l.id === layerId) ?? sheet.layers?.[0];
  const lasso = useRef<Point[]>([]),
    mask = useRef<Uint8Array | null>(null);
  const editable = () => ({
    ...clone(sheet),
    pixels: (layer?.pixels ?? sheet.pixels).slice(),
  });
  const commit = (pixels: Uint8Array) =>
    change((p) => {
      const s = p.sheets.find((s) => s.id === sheet.id)!;
      if (s.layers) {
        const l = s.layers.find((l) => l.id === layer?.id)!;
        if (l.locked) return;
        l.pixels = pixels;
        flattenSheet(s);
      } else s.pixels = pixels;
    });
  const canvas = useRef<HTMLCanvasElement>(null),
    draft = useRef<Sheet | null>(null),
    start = useRef<Point | null>(null),
    last = useRef<Point | null>(null),
    clip = useRef<{ width: number; height: number; pixels: Uint8Array } | null>(
      null,
    );
  const pal =
    project.palettes.find((p) => p.id === paletteId) ??
    project.palettes.find((p) => p.id === sheet.paletteId)!;
  function draw(input?: Sheet) {
    let s = input ?? sheet;
    if (input && layer && sheet.layers) {
      s = clone(sheet);
      s.layers!.find((l) => l.id === layer.id)!.pixels = input.pixels;
      flattenSheet(s);
    }
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!,
      image = renderSheet(project, s, pal.id);
    c.width = s.width * zoom;
    c.height = s.height * zoom;
    ctx.fillStyle = "#252a34";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++)
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "#2e3440";
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
    const tiny = document.createElement("canvas");
    tiny.width = s.width;
    tiny.height = s.height;
    tiny
      .getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(image.data), s.width, s.height),
        0,
        0,
      );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, c.width, c.height);
    if (grid) {
      for (let x = 0; x <= s.width; x++) {
        ctx.strokeStyle = x % 8 === 0 ? "#93a4be77" : "#00000025";
        ctx.beginPath();
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, c.height);
        ctx.stroke();
      }
      for (let y = 0; y <= s.height; y++) {
        ctx.strokeStyle = y % 8 === 0 ? "#93a4be77" : "#00000025";
        ctx.beginPath();
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(c.width, y * zoom + 0.5);
        ctx.stroke();
      }
    }
    if (selection) {
      ctx.strokeStyle = "#6ec9ff";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        selection.x * zoom,
        selection.y * zoom,
        selection.width * zoom,
        selection.height * zoom,
      );
    }
    if (lasso.current.length) {
      ctx.strokeStyle = "#6ec9ff";
      ctx.beginPath();
      lasso.current.forEach((p, i) =>
        i
          ? ctx.lineTo(p.x * zoom, p.y * zoom)
          : ctx.moveTo(p.x * zoom, p.y * zoom),
      );
      ctx.stroke();
    }
  }
  useEffect(() => {
    draft.current = null;
    setSelection(null);
    mask.current = null;
    lasso.current = [];
    start.current = null;
    last.current = null;
    setZoom((z) =>
      Math.max(
        1,
        Math.min(z, Math.floor(4096 / Math.max(sheet.width, sheet.height))),
      ),
    );
  }, [sheet.id, sheet.width, sheet.height]);
  useEffect(() => {
    draw();
  }, [sheet, pal, zoom, grid, selection]);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(sheet.width - 1, Math.floor((e.clientX - r.left) / zoom)),
      ),
      y: Math.max(
        0,
        Math.min(sheet.height - 1, Math.floor((e.clientY - r.top) / zoom)),
      ),
    };
  };
  const mark = (s: Sheet, x: number, y: number) => {
    if (mask.current && !mask.current[y * s.width + x]) return;
    if (
      selection &&
      (x < selection.x ||
        y < selection.y ||
        x >= selection.x + selection.width ||
        y >= selection.y + selection.height)
    )
      return;
    put(s, x, y, tool === "erase" ? 0 : color);
    if (sym) put(s, s.width - 1 - x, y, tool === "erase" ? 0 : color);
  };
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft.current || !start.current) return;
    const b = pos(e),
      a = start.current;
    if (tool === "select") {
      setSelection({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x) + 1,
        height: Math.abs(a.y - b.y) + 1,
      });
      return;
    }
    if (tool === "lasso") {
      lasso.current.push(b);
      draw();
      return;
    }
    if (tool === "move" && selection) {
      const source = editable(),
        target = editable(),
        dx = b.x - a.x,
        dy = b.y - a.y;
      for (let y = selection.y; y < selection.y + selection.height; y++)
        for (let x = selection.x; x < selection.x + selection.width; x++)
          if (!mask.current || mask.current[y * sheet.width + x])
            put(target, x, y, 0);
      for (let y = selection.y; y < selection.y + selection.height; y++)
        for (let x = selection.x; x < selection.x + selection.width; x++)
          if (!mask.current || mask.current[y * sheet.width + x])
            put(target, x + dx, y + dy, pixel(source, x, y));
      draft.current = target;
      last.current = b;
      draw(target);
      return;
    }
    if (["line", "rect", "ellipse"].includes(tool)) {
      draft.current = editable();
      const s = draft.current;
      if (tool === "line") line(a, b, (x, y) => mark(s, x, y));
      if (tool === "rect") {
        line(a, { x: b.x, y: a.y }, (x, y) => mark(s, x, y));
        line(a, { x: a.x, y: b.y }, (x, y) => mark(s, x, y));
        line(b, { x: b.x, y: a.y }, (x, y) => mark(s, x, y));
        line(b, { x: a.x, y: b.y }, (x, y) => mark(s, x, y));
      }
      if (tool === "ellipse") {
        const cx = (a.x + b.x) / 2,
          cy = (a.y + b.y) / 2,
          rx = Math.abs(a.x - b.x) / 2,
          ry = Math.abs(a.y - b.y) / 2;
        for (let i = 0; i < 360; i++)
          mark(
            s,
            Math.round(cx + rx * Math.cos((i * Math.PI) / 180)),
            Math.round(cy + ry * Math.sin((i * Math.PI) / 180)),
          );
      }
    } else if (tool === "pen" || tool === "erase")
      line(last.current ?? b, b, (x, y) => mark(draft.current!, x, y));
    last.current = b;
    draw(draft.current);
  }
  function end() {
    if (!draft.current) return;
    const pixels = draft.current.pixels.slice();
    if (tool === "lasso") {
      const points = lasso.current,
        selected = new Uint8Array(sheet.width * sheet.height);
      if (points.length > 2) {
        for (let y = 0; y < sheet.height; y++)
          for (let x = 0; x < sheet.width; x++) {
            let inside = false;
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
              const a = points[i],
                b = points[j];
              if (
                a.y > y !== b.y > y &&
                x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
              )
                inside = !inside;
            }
            selected[y * sheet.width + x] = +inside;
          }
        mask.current = selected;
        const xs = points.map((p) => p.x),
          ys = points.map((p) => p.y);
        setSelection({
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs) + 1,
          height: Math.max(...ys) - Math.min(...ys) + 1,
        });
      }
      lasso.current = [];
    } else if (tool !== "select" && tool !== "pick") commit(pixels);
    if (tool === "move") {
      mask.current = null;
      setSelection(null);
    }
    draft.current = null;
    start.current = null;
    last.current = null;
  }
  const copy = () => {
    const source = editable();
    const r = selection ?? {
      x: 0,
      y: 0,
      width: sheet.width,
      height: sheet.height,
    };
    const data = new Uint8Array(r.width * r.height);
    for (let y = 0; y < r.height; y++)
      for (let x = 0; x < r.width; x++)
        data[y * r.width + x] =
          !mask.current || mask.current[(r.y + y) * sheet.width + r.x + x]
            ? pixel(source, r.x + x, r.y + y)
            : 0;
    clip.current = { width: r.width, height: r.height, pixels: data };
  };
  const tools: [Tool, string, string, string][] = [
    ["pen", "✎", "Crayon", "Pencil"],
    ["erase", "⌫", "Gomme", "Eraser"],
    ["fill", "▧", "Remplir", "Fill"],
    ["pick", "⌖", "Pipette", "Picker"],
    ["line", "╱", "Ligne", "Line"],
    ["rect", "□", "Rectangle", "Rectangle"],
    ["ellipse", "○", "Ellipse", "Ellipse"],
    ["select", "▱", "Sélection", "Selection"],
    ["lasso", "⌁", "Lasso", "Lasso"],
    ["move", "✥", "Déplacer", "Move"],
  ];
  return (
    <>
      <div className="work">
        <div className="toolbar">
          {tools.map(([key, icon, fr, en]) => (
            <button
              key={key}
              title={tr(fr, en)}
              aria-label={tr(fr, en)}
              className={tool === key ? "active" : ""}
              onClick={() => setTool(key)}
            >
              {icon}
            </button>
          ))}
          <span className="separator" />
          <button onClick={() => setZoom(Math.max(1, zoom - 1))}>−</button>
          <span>{zoom * 100}%</span>
          <button
            onClick={() =>
              setZoom(
                Math.min(
                  32,
                  Math.floor(4096 / Math.max(sheet.width, sheet.height)),
                  zoom + 1,
                ),
              )
            }
          >
            ＋
          </button>
          <Check label={tr("Grille", "Grid")} value={grid} onChange={setGrid} />
          <Check
            label={tr("Symétrie", "Symmetry")}
            value={sym}
            onChange={setSym}
          />
        </div>
        <div className="drawing-area">
          <canvas
            aria-label={tr("Zone de dessin", "Drawing canvas")}
            ref={canvas}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (layer?.locked) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const a = pos(e);
              if (tool === "pick") {
                setColor(pixel(sheet, a.x, a.y));
                return;
              }
              draft.current = editable();
              start.current = a;
              last.current = a;
              if (tool === "select" || tool === "lasso") {
                setSelection(null);
                mask.current = null;
                lasso.current = tool === "lasso" ? [a] : [];
              } else if (tool === "fill") {
                const original = draft.current.pixels.slice();
                fill(draft.current, a.x, a.y, color);
                if (selection || mask.current)
                  for (let n = 0; n < original.length; n++) {
                    const x = n % sheet.width,
                      y = Math.floor(n / sheet.width);
                    if (
                      (mask.current && !mask.current[n]) ||
                      (selection &&
                        (x < selection.x ||
                          y < selection.y ||
                          x >= selection.x + selection.width ||
                          y >= selection.y + selection.height))
                    )
                      draft.current.pixels[n] = original[n];
                  }
                draw(draft.current);
              } else move(e);
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => {
              draft.current = null;
              draw();
            }}
          />
        </div>
        <div className="palette-strip">
          {pal.colors.slice(0, 1 << sheet.bpp).map((c, i) => (
            <button
              key={i}
              aria-label={`${tr("Couleur", "Color")} ${i}`}
              className={`${color === i ? "selected" : ""} ${i === 0 ? "transparent" : ""}`}
              style={{ background: i ? hex(c) : undefined }}
              onClick={() => setColor(i)}
            >
              <span>{i.toString(16).toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
      <aside className="inspector">
        <h3>{tr("Dessin", "Drawing")}</h3>
        <Field label={tr("Nom", "Name")}>
          <input
            value={sheet.name}
            onChange={(e) =>
              change((p) => {
                p.sheets.find((s) => s.id === sheet.id)!.name = e.target.value;
              })
            }
          />
        </Field>
        <Select
          label={tr("Palette d’aperçu", "Preview palette")}
          value={pal.id}
          options={project.palettes
            .filter((p) => p.colors.length >= 1 << sheet.bpp)
            .map((p) => ({ value: p.id, label: p.name }))}
          onChange={setPalette}
        />
        <button
          onClick={() =>
            change((p) => {
              p.sheets.find((s) => s.id === sheet.id)!.paletteId = pal.id;
            })
          }
        >
          {tr("Définir par défaut", "Set as default")}
        </button>
        <p className="muted">
          {sheet.width} × {sheet.height} · {sheet.bpp} bpp ·{" "}
          {(sheet.width * sheet.height) / 64} tiles
        </p>
        <div className="button-row">
          <button
            disabled={sheet.height >= 4096}
            title={tr(
              "Ajouter une ligne de tiles en bas (+8 pixels)",
              "Add a row of tiles at the bottom (+8 pixels)",
            )}
            onClick={() =>
              change((p) =>
                growSheet(p, sheet.id, sheet.width, sheet.height + 8),
              )
            }
          >
            + {tr("Ligne de tiles", "Row of tiles")}
          </button>
          <button
            disabled={sheet.width >= 4096}
            title={tr(
              "Ajouter une colonne de tiles à droite (+8 pixels)",
              "Add a column of tiles on the right (+8 pixels)",
            )}
            onClick={() =>
              change((p) =>
                growSheet(p, sheet.id, sheet.width + 8, sheet.height),
              )
            }
          >
            + {tr("Colonne de tiles", "Column of tiles")}
          </button>
        </div>
        <SheetLayout
          project={project}
          sheet={sheet}
          selection={selection}
          change={change}
          onApplied={() => {
            setSelection(null);
            mask.current = null;
          }}
        />
        <div className="preview-tile">
          <Preview image={renderSheet(project, sheet, pal.id)} scale={2} />
        </div>
        <Check
          label={tr("Vérifier les raccords", "Check tiling")}
          value={repeat}
          onChange={setRepeat}
        />
        {repeat && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,max-content)",
              overflow: "auto",
            }}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <Preview key={i} image={renderSheet(project, sheet, pal.id)} />
            ))}
          </div>
        )}
        <h3>{tr("Calques de dessin", "Drawing layers")}</h3>
        {sheet.layers?.map((l) => (
          <div key={l.id} className="layer-row">
            <button
              className={layer?.id === l.id ? "active" : ""}
              onClick={() => setLayerId(l.id)}
            >
              {l.name}
            </button>
            <Check
              label={tr("Visible", "Visible")}
              value={l.visible}
              onChange={(v) =>
                change((p) => {
                  const s = p.sheets.find((s) => s.id === sheet.id)!;
                  s.layers!.find((a) => a.id === l.id)!.visible = v;
                  flattenSheet(s);
                })
              }
            />
            <Check
              label={tr("Verrouiller", "Lock")}
              value={l.locked}
              onChange={(v) =>
                change((p) => {
                  p.sheets
                    .find((s) => s.id === sheet.id)!
                    .layers!.find((a) => a.id === l.id)!.locked = v;
                })
              }
            />
          </div>
        ))}
        {layer && (
          <>
            <Field label={tr("Nom du calque", "Layer name")}>
              <input
                value={layer.name}
                onChange={(e) =>
                  change((p) => {
                    p.sheets
                      .find((s) => s.id === sheet.id)!
                      .layers!.find((l) => l.id === layer.id)!.name =
                      e.target.value;
                  })
                }
              />
            </Field>
            <div className="button-row">
              {[-1, 1].map((direction) => (
                <button
                  key={direction}
                  disabled={
                    sheet.layers!.findIndex((l) => l.id === layer.id) +
                      direction <
                      0 ||
                    sheet.layers!.findIndex((l) => l.id === layer.id) +
                      direction >=
                      sheet.layers!.length
                  }
                  onClick={() =>
                    change((p) => {
                      const s = p.sheets.find((s) => s.id === sheet.id)!,
                        i = s.layers!.findIndex((l) => l.id === layer.id);
                      [s.layers![i], s.layers![i + direction]] = [
                        s.layers![i + direction],
                        s.layers![i],
                      ];
                      flattenSheet(s);
                    })
                  }
                >
                  {direction < 0
                    ? tr("Descendre", "Lower")
                    : tr("Monter", "Raise")}
                </button>
              ))}
              <button
                disabled={sheet.layers!.length === 1 || layer.locked}
                onClick={() =>
                  change((p) => {
                    const s = p.sheets.find((s) => s.id === sheet.id)!;
                    s.layers = s.layers!.filter((l) => l.id !== layer.id);
                    flattenSheet(s);
                    setLayerId(s.layers[0].id);
                  })
                }
              >
                {tr("Supprimer le calque", "Delete layer")}
              </button>
            </div>
          </>
        )}
        <button
          onClick={() =>
            change((p) => {
              const s = p.sheets.find((s) => s.id === sheet.id)!;
              s.layers ??= [
                {
                  id: uid(),
                  name: tr("Base", "Base"),
                  visible: true,
                  locked: false,
                  pixels: s.pixels.slice(),
                },
              ];
              const l = {
                id: uid(),
                name: tr("Calque", "Layer") + " " + (s.layers.length + 1),
                visible: true,
                locked: false,
                pixels: new Uint8Array(s.pixels.length),
              };
              s.layers.push(l);
              setLayerId(l.id);
            })
          }
        >
          ＋ {tr("Calque", "Layer")}
        </button>
        {sheet.layers && (
          <button
            onClick={() =>
              change((p) => {
                const s = p.sheets.find((s) => s.id === sheet.id)!;
                flattenSheet(s);
                delete s.layers;
                setLayerId("");
              })
            }
          >
            {tr("Aplatir les calques", "Flatten layers")}
          </button>
        )}
        <h3>{tr("Transformer", "Transform")}</h3>
        <div className="button-row">
          {(["flipX", "flipY", "rotate"] as const).map((op, i) => (
            <button
              key={op}
              onClick={() => {
                const s = editable(),
                  r = selection ?? {
                    x: 0,
                    y: 0,
                    width: s.width,
                    height: s.height,
                  };
                if (op === "rotate" && r.width !== r.height) {
                  return;
                }
                const part = {
                  ...s,
                  width: r.width,
                  height: r.height,
                  pixels: new Uint8Array(r.width * r.height),
                };
                for (let y = 0; y < r.height; y++)
                  for (let x = 0; x < r.width; x++)
                    part.pixels[y * r.width + x] = pixel(s, r.x + x, r.y + y);
                transform(part, op);
                for (let y = 0; y < r.height; y++)
                  for (let x = 0; x < r.width; x++)
                    put(s, r.x + x, r.y + y, part.pixels[y * r.width + x]);
                commit(s.pixels);
              }}
              disabled={
                !!layer?.locked ||
                (op === "rotate" &&
                  (selection?.width ?? sheet.width) !==
                    (selection?.height ?? sheet.height))
              }
              title={
                op === "rotate"
                  ? tr(
                      "Rotation d’une sélection carrée",
                      "Rotate a square selection",
                    )
                  : op
              }
            >
              {["↔", "↕", "↻"][i]}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            commit(
              editable().pixels.map((v) => (v === replaceIndex ? color : v)),
            )
          }
        >
          {tr("Remplacer par l’indice actif", "Replace with active index")}
        </button>
        <NumberField
          label={tr("Indice à remplacer", "Index to replace")}
          value={replaceIndex}
          min={0}
          max={(1 << sheet.bpp) - 1}
          onChange={setReplaceIndex}
        />
        <h3>{tr("Sélection", "Selection")}</h3>
        {selection && (
          <p className="muted">
            {tileUses(
              project,
              sheet.id,
              Math.floor(selection.y / 8) * (sheet.width / 8) +
                Math.floor(selection.x / 8),
            )
              .map((u) => `${u.name} (${u.count})`)
              .join(", ") || tr("Tile sans autre usage", "No other tile uses")}
          </p>
        )}
        <div className="button-row">
          <button onClick={copy}>{tr("Copier", "Copy")}</button>
          <button
            onClick={() => {
              if (!clip.current) return;
              const c = clip.current;
              {
                const s = editable();
                for (let y = 0; y < c.height; y++)
                  for (let x = 0; x < c.width; x++)
                    put(
                      s,
                      (selection?.x ?? 0) + x,
                      (selection?.y ?? 0) + y,
                      c.pixels[y * c.width + x],
                    );
                commit(s.pixels);
              }
            }}
          >
            {tr("Coller", "Paste")}
          </button>
        </div>
        <button
          onClick={() => {
            setSelection(null);
            mask.current = null;
          }}
        >
          {tr("Désélectionner", "Deselect")}
        </button>
        <NumberField
          label={tr("Indice actif", "Active index")}
          value={color}
          min={0}
          max={Math.min(pal.colors.length, 1 << sheet.bpp) - 1}
          onChange={setColor}
        />
      </aside>
    </>
  );
}
