import { useRef, useState } from "react";
import {
  clone,
  makeCell,
  uid,
  type Project,
  type Tilemap,
  type Cell,
} from "../core/model";
import { renderMap, renderSheet } from "../core/render";
import { Check, Field, NumberField, Preview, Select } from "./controls";
import { tr } from "../i18n";
import { connectTerrain } from "../core/terrain";
import { makeLocalTile, tileUses } from "../core/resources";
export function Maps({
  project,
  map,
  change,
}: {
  project: Project;
  map: Tilemap;
  change: (fn: (p: Project) => void) => void;
}) {
  const [tile, setTile] = useState(0),
    [scale, setScale] = useState(2),
    [paletteId, setPalette] = useState(map.cells[0].paletteId),
    [flipX, setX] = useState(false),
    [flipY, setY] = useState(false),
    [priority, setPriority] = useState(false),
    [collision, setCollision] = useState(0),
    [stamp, setStamp] = useState(""),
    [terrainId, setTerrainId] = useState(""),
    [directColor, setDirectColor] = useState(0),
    [draft, setDraft] = useState<Tilemap | null>(null),
    [brush, setBrush] = useState<"paint" | "fill" | "pick" | "select">("paint"),
    [selectedRegion, setSelection] = useState({
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });
  const selection = {
    x: Math.min(selectedRegion.x, map.width - 1),
    y: Math.min(selectedRegion.y, map.height - 1),
    width: 1,
    height: 1,
  };
  selection.width = Math.min(selectedRegion.width, map.width - selection.x);
  selection.height = Math.min(selectedRegion.height, map.height - selection.y);
  const stroke = useRef<Tilemap | null>(null),
    start = useRef({ x: 0, y: 0 });
  const sheet = project.sheets.find((s) => s.id === map.sheetId)!;
  const edit = (fn: (m: Tilemap) => void) =>
    change((p) => fn(p.maps.find((m) => m.id === map.id)!));
  const paint = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.floor((e.clientX - r.left) / 8 / scale),
      y = Math.floor((e.clientY - r.top) / 8 / scale);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    if (brush === "select") {
      setSelection({
        x: Math.min(x, start.current.x),
        y: Math.min(y, start.current.y),
        width: Math.abs(x - start.current.x) + 1,
        height: Math.abs(y - start.current.y) + 1,
      });
      return;
    }
    if (brush === "pick") {
      const c = map.cells[y * map.width + x];
      setTile(c.tile);
      setPalette(c.paletteId);
      setX(c.flipX);
      setY(c.flipY);
      setPriority(c.priority);
      setCollision(c.collision);
      return;
    }
    const c: Cell = {
      tile,
      paletteId,
      flipX,
      flipY,
      priority,
      collision,
      directColor,
      terrain: terrainId || undefined,
    };
    const m = stroke.current;
    if (!m) return;
    {
      const st = m.stamps.find((s) => s.id === stamp);
      if (st) {
        for (let yy = 0; yy < st.height; yy++)
          for (let xx = 0; xx < st.width; xx++)
            if (x + xx < m.width && y + yy < m.height)
              m.cells[(y + yy) * m.width + x + xx] = clone(
                st.cells[yy * st.width + xx],
              );
      } else if (brush === "fill") {
        const old = JSON.stringify(m.cells[y * m.width + x]);
        if (old === JSON.stringify(c)) return;
        const q = [y * m.width + x];
        while (q.length) {
          const n = q.pop()!;
          if (JSON.stringify(m.cells[n]) !== old) continue;
          m.cells[n] = clone(c);
          const xx = n % m.width,
            yy = Math.floor(n / m.width);
          if (xx) q.push(n - 1);
          if (xx < m.width - 1) q.push(n + 1);
          if (yy) q.push(n - m.width);
          if (yy < m.height - 1) q.push(n + m.width);
        }
      } else m.cells[y * m.width + x] = c;
    }
    for (const terrain of m.terrains ?? []) connectTerrain(m, terrain.id);
    setDraft(clone(m));
  };
  return (
    <>
      <div className="work">
        <div className="toolbar">
          <Select
            label={tr("Outil", "Tool")}
            value={brush}
            options={[
              { value: "paint", label: tr("Peindre", "Paint") },
              { value: "fill", label: tr("Remplir", "Fill") },
              { value: "pick", label: tr("Prélever", "Pick") },
              { value: "select", label: tr("Sélectionner", "Select") },
            ]}
            onChange={(v) => setBrush(v as typeof brush)}
          />
          <button onClick={() => setScale(Math.max(1, scale - 1))}>−</button>
          <span>{scale * 100}%</span>
          <button onClick={() => setScale(Math.min(8, scale + 1))}>＋</button>
          <span>
            {map.width} × {map.height} tiles
          </span>
        </div>
        <div className="map-scroll">
          <div
            className="map-canvas"
            style={{
              width: map.width * 8 * scale,
              height: map.height * 8 * scale,
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              stroke.current = clone(map);
              const r = e.currentTarget.getBoundingClientRect();
              start.current = {
                x: Math.floor((e.clientX - r.left) / 8 / scale),
                y: Math.floor((e.clientY - r.top) / 8 / scale),
              };
              paint(e);
            }}
            onPointerMove={(e) => {
              if (stroke.current) paint(e);
            }}
            onPointerUp={() => {
              const next = stroke.current;
              if (next && brush !== "select" && brush !== "pick")
                edit((m) => {
                  m.cells = next.cells;
                });
              stroke.current = null;
              setDraft(null);
            }}
            onPointerCancel={() => {
              stroke.current = null;
              setDraft(null);
            }}
          >
            <Preview
              image={renderMap(
                draft
                  ? {
                      ...project,
                      maps: project.maps.map((m) =>
                        m.id === draft.id ? draft : m,
                      ),
                    }
                  : project,
                map.id,
              )}
              scale={scale}
            />
            {brush === "select" && (
              <div
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  border: "1px solid white",
                  left: selection.x * 8 * scale,
                  top: selection.y * 8 * scale,
                  width: selection.width * 8 * scale,
                  height: selection.height * 8 * scale,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <aside className="inspector">
        <h3>{tr("Carte", "Map")}</h3>
        <Field label={tr("Nom", "Name")}>
          <input
            value={map.name}
            onChange={(e) =>
              edit((m) => {
                m.name = e.target.value;
              })
            }
          />
        </Field>
        <Select
          label={tr("Tileset", "Tileset")}
          value={map.sheetId}
          options={project.sheets.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(id) =>
            edit((m) => {
              m.sheetId = id;
              const s = project.sheets.find((s) => s.id === id)!;
              if (
                [...m.cells, ...m.stamps.flatMap((st) => st.cells)].some(
                  (c) => c.tile >= (s.width * s.height) / 64,
                ) ||
                m.terrains?.some((t) =>
                  t.tiles.some((n) => n >= s.pixels.length / 64),
                ) ||
                m.animatedTiles.some(
                  (a) =>
                    a.tile >= s.pixels.length / 64 ||
                    a.frames.some((n) => n >= s.pixels.length / 64),
                )
              )
                throw new Error(
                  tr(
                    "Ce tileset contient trop peu de tiles pour cette carte.",
                    "This tileset has too few tiles for this map.",
                  ),
                );
              m.cells = m.cells.map((c) => ({ ...c, paletteId: s.paletteId }));
              setPalette(s.paletteId);
              setTile(0);
              setStamp("");
              setTerrainId("");
            })
          }
        />
        <div className="number-row">
          {(["width", "height"] as const).map((k) => (
            <NumberField
              key={k}
              label={
                k === "width" ? tr("Largeur", "Width") : tr("Hauteur", "Height")
              }
              value={map[k]}
              min={1}
              max={512}
              onChange={(v) =>
                edit((m) => {
                  const old = clone(m);
                  m[k] = v;
                  m.cells = Array.from(
                    { length: m.width * m.height },
                    (_, i) => {
                      const x = i % m.width,
                        y = Math.floor(i / m.width);
                      return x < old.width && y < old.height
                        ? old.cells[y * old.width + x]
                        : makeCell(paletteId);
                    },
                  );
                })
              }
            />
          ))}
        </div>
        <h3>{tr("Pinceau", "Brush")}</h3>
        <div
          className="tiles-picker"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect(),
              x = Math.floor((e.clientX - r.left) / 24),
              y = Math.floor((e.clientY - r.top) / 24);
            setTile(
              Math.min(
                (sheet.width * sheet.height) / 64 - 1,
                y * (sheet.width / 8) + x,
              ),
            );
            setStamp("");
          }}
          style={{ width: sheet.width * 3 }}
        >
          <Preview image={renderSheet(project, sheet, paletteId)} scale={3} />
        </div>
        <NumberField
          label={tr("Numéro de tile", "Tile number")}
          value={tile}
          min={0}
          max={(sheet.width * sheet.height) / 64 - 1}
          onChange={setTile}
        />
        <Select
          label={tr("Palette", "Palette")}
          value={paletteId}
          options={project.palettes
            .filter((p) => p.colors.length >= 1 << sheet.bpp)
            .map((p) => ({ value: p.id, label: p.name }))}
          onChange={setPalette}
        />
        <Check
          label={tr("Miroir horizontal", "Flip horizontally")}
          value={flipX}
          onChange={setX}
        />
        {sheet.bpp === 8 && (
          <NumberField
            label={tr("Bits de couleur directe", "Direct color bits")}
            value={directColor}
            min={0}
            max={7}
            onChange={setDirectColor}
          />
        )}
        <Check
          label={tr("Miroir vertical", "Flip vertically")}
          value={flipY}
          onChange={setY}
        />
        <Check
          label={tr("Priorité haute", "High priority")}
          value={priority}
          onChange={setPriority}
        />
        <NumberField
          label={tr("Collision", "Collision")}
          value={collision}
          min={0}
          max={255}
          onChange={setCollision}
        />
        <h3>{tr("Métatiles", "Metatiles")}</h3>
        <p className="muted">
          {tileUses(project, sheet.id, tile)
            .map((u) => `${u.name} (${u.count})`)
            .join(", ")}
        </p>
        <button
          onClick={() =>
            change((p) => {
              setTile(
                makeLocalTile(p, map.id, selection.y * map.width + selection.x),
              );
            })
          }
        >
          {tr("Rendre indépendante la tile en", "Make local the tile at")}{" "}
          {selection.x}, {selection.y}
        </button>
        <button
          onClick={() =>
            edit((m) => {
              const source = m.cells[selection.y * m.width + selection.x].tile;
              m.cells = m.cells.map((c) =>
                c.tile === source
                  ? { ...c, tile, paletteId, flipX, flipY, priority, collision }
                  : c,
              );
            })
          }
        >
          {tr(
            "Remplacer toutes les occurrences de la tile sélectionnée",
            "Replace all occurrences of the selected tile",
          )}
        </button>
        <Select
          label={tr("Terrain automatique", "Auto terrain")}
          value={terrainId}
          options={[
            { value: "", label: tr("Aucun", "None") },
            ...(map.terrains ?? []).map((t) => ({
              value: t.id,
              label: t.name,
            })),
          ]}
          onChange={(v) => {
            setTerrainId(v);
            setStamp("");
          }}
        />
        <button
          onClick={() =>
            edit((m) => {
              const t = {
                id: uid(),
                name:
                  tr("Terrain", "Terrain") +
                  " " +
                  ((m.terrains?.length ?? 0) + 1),
                tiles: Array(16).fill(tile),
              };
              m.terrains ??= [];
              m.terrains.push(t);
              setTerrainId(t.id);
            })
          }
        >
          ＋ {tr("Terrain automatique", "Auto terrain")}
        </button>
        {map.terrains
          ?.filter((t) => t.id === terrainId)
          .map((t) => (
            <details key={t.id}>
              <summary>{tr("Règles de raccord", "Connection rules")}</summary>
              <p className="muted">N=1 · E=2 · S=4 · O/W=8</p>
              {t.tiles.map((value, mask) => (
                <NumberField
                  key={mask}
                  label={String(mask)}
                  value={value}
                  min={0}
                  max={sheet.pixels.length / 64 - 1}
                  onChange={(v) =>
                    edit((m) => {
                      m.terrains!.find((t) => t.id === terrainId)!.tiles[mask] =
                        v;
                      connectTerrain(m, terrainId);
                    })
                  }
                />
              ))}
            </details>
          ))}
        <Select
          label={tr("Tampon", "Stamp")}
          value={stamp}
          options={[
            { value: "", label: tr("Tile seule", "Single tile") },
            ...map.stamps.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={setStamp}
        />
        <button
          onClick={() =>
            edit((m) => {
              m.stamps.push({
                id: uid(),
                name: tr("Motif", "Pattern") + " " + (m.stamps.length + 1),
                width: Math.min(selection.width, m.width - selection.x),
                height: Math.min(selection.height, m.height - selection.y),
                cells: m.cells
                  .filter(
                    (_, i) =>
                      i % m.width >= selection.x &&
                      i % m.width < selection.x + selection.width &&
                      Math.floor(i / m.width) >= selection.y &&
                      Math.floor(i / m.width) < selection.y + selection.height,
                  )
                  .map(clone),
              });
            })
          }
        >
          {tr("Capturer la sélection", "Capture selection")} ({selection.width}{" "}
          × {selection.height})
        </button>
        <h3>{tr("Tile animée", "Animated tile")}</h3>
        {map.animatedTiles.map((a, n) => (
          <div key={n}>
            <NumberField
              label={tr("Tile source", "Source tile")}
              value={a.tile}
              min={0}
              max={(sheet.width * sheet.height) / 64 - 1}
              onChange={(v) =>
                edit((m) => {
                  m.animatedTiles[n].tile = v;
                })
              }
            />
            <Field
              label={tr(
                "Séquence (numéros séparés par virgules)",
                "Sequence (comma-separated indices)",
              )}
            >
              <input
                value={a.frames.join(",")}
                onChange={(e) => {
                  const frames = e.target.value
                    .split(",")
                    .map(Number)
                    .filter(
                      (v) =>
                        Number.isInteger(v) &&
                        v >= 0 &&
                        v < (sheet.width * sheet.height) / 64,
                    );
                  edit((m) => {
                    m.animatedTiles[n].frames = frames;
                  });
                }}
              />
            </Field>
            <NumberField
              label={tr("Images par étape", "Frames per step")}
              value={a.ticks}
              min={1}
              onChange={(v) =>
                edit((m) => {
                  m.animatedTiles[n].ticks = v;
                })
              }
            />
          </div>
        ))}
        <button
          onClick={() =>
            edit((m) => {
              m.animatedTiles.push({ tile, frames: [tile], ticks: 8 });
            })
          }
        >
          ＋ {tr("Animer la tile", "Animate tile")}
        </button>
      </aside>
    </>
  );
}
