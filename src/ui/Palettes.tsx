import { useState } from "react";
import {
  clone,
  fromHex,
  hex,
  rgb,
  rgb555,
  uid,
  uses,
  type Project,
  type Palette,
} from "../core/model";
import { renderSheet } from "../core/render";
import { swapPaletteColors } from "../core/resources";
import { Check, Field, NumberField, Preview } from "./controls";
import { tr } from "../i18n";
import { useTick } from "./Sprites";
let copiedColors: { colors: number[]; labels: string[] } | null = null;
export function Palettes({
  project,
  palette,
  change,
  select,
}: {
  project: Project;
  palette: Palette;
  change: (fn: (p: Project) => void) => void;
  select: (id: string) => void;
}) {
  const [index, setIndex] = useState(1);
  const [range, setRange] = useState(1),
    [playing, setPlaying] = useState(false);
  const tick = useTick(playing, project.fps);
  const i = Math.min(index, palette.colors.length - 1);
  const update = (fn: (p: Palette) => void) =>
    change((p) => fn(p.palettes.find((x) => x.id === palette.id)!));
  const [r, g, b] = rgb(palette.colors[i]);
  const swap = () => change((p) => swapPaletteColors(p, palette.id, i));
  return (
    <>
      <div className="work palette-work">
        <div className="document-title">
          <h2>{palette.name}</h2>
          <span>
            {palette.colors.length - 1}{" "}
            {tr("couleurs + transparence", "colors + transparency")}
          </span>
        </div>
        <div className="color-grid">
          {palette.colors.map((c, n) => (
            <button
              key={n}
              aria-label={`${tr("Entrée", "Entry")} ${n}`}
              className={`${i === n ? "selected" : ""} ${n === 0 ? "transparent" : ""}`}
              style={{ background: n ? hex(c) : undefined }}
              onClick={() => setIndex(n)}
            >
              <span>{n.toString(16).toUpperCase().padStart(2, "0")}</span>
              <small>
                {palette.locked[n] ? "◆ " : ""}
                {palette.labels[n]}
              </small>
            </button>
          ))}
        </div>
        <h3>{tr("Aperçu sur les dessins", "Preview on graphics")}</h3>
        <div className="palette-previews">
          {project.sheets
            .filter((s) => 1 << s.bpp <= palette.colors.length)
            .map((s) => (
              <div key={s.id}>
                <Preview
                  image={renderSheet(project, s, palette.id, tick)}
                  scale={3}
                />
                <p>{s.name}</p>
              </div>
            ))}
        </div>
      </div>
      <aside className="inspector">
        <h3>{tr("Palette", "Palette")}</h3>
        <button disabled={!palette.cycle} onClick={() => setPlaying(!playing)}>
          {playing ? "Ⅱ" : "▶"} {tr("Aperçu du cycle", "Preview cycle")}
        </button>
        <Field label={tr("Nom", "Name")}>
          <input
            value={palette.name}
            onChange={(e) =>
              update((p) => {
                p.name = e.target.value;
              })
            }
          />
        </Field>
        <button
          onClick={() => {
            const cp = clone(palette);
            cp.id = uid();
            cp.name += " " + tr("copie", "copy");
            change((p) => {
              p.palettes.push(cp);
            });
            select(cp.id);
          }}
        >
          {tr("Dupliquer la palette", "Duplicate palette")}
        </button>
        <h3>
          {tr("Couleur", "Color")} {i}
        </h3>
        <NumberField
          label={tr("Nombre d’entrées à copier", "Entries to copy")}
          value={range}
          min={1}
          max={palette.colors.length - i}
          onChange={setRange}
        />
        <div className="button-row">
          <button
            onClick={() => {
              copiedColors = {
                colors: palette.colors.slice(i, i + range),
                labels: palette.labels.slice(i, i + range),
              };
            }}
          >
            {tr("Copier les couleurs", "Copy colors")}
          </button>
          <button
            onClick={() => {
              if (!copiedColors) return;
              const cp = copiedColors;
              update((p) => {
                for (
                  let n = 0;
                  n < cp.colors.length && i + n < p.colors.length;
                  n++
                ) {
                  if (i + n === 0 || p.locked[i + n]) continue;
                  p.colors[i + n] = cp.colors[n];
                  p.labels[i + n] = cp.labels[n];
                }
              });
            }}
          >
            {tr("Coller", "Paste")}
          </button>
        </div>
        <p className="muted">
          {palette.colors.flatMap((v, n) =>
            n !== i && n !== 0 && v === palette.colors[i] ? [n] : [],
          ).length
            ? tr("Même couleur aux indices : ", "Same color at indices: ") +
              palette.colors
                .flatMap((v, n) =>
                  n !== i && n !== 0 && v === palette.colors[i] ? [n] : [],
                )
                .join(", ")
            : ""}
        </p>
        {i === 0 ? (
          <p>{tr("L’indice 0 est transparent.", "Index 0 is transparent.")}</p>
        ) : (
          <>
            <input
              className="color-picker"
              aria-label={tr("Choisir la couleur", "Choose color")}
              type="color"
              value={hex(palette.colors[i])}
              disabled={palette.locked[i]}
              onChange={(e) =>
                update((p) => {
                  p.colors[i] = fromHex(e.target.value);
                })
              }
            />
            <div className="number-row">
              {[r, g, b].map((v, n) => (
                <NumberField
                  key={n}
                  label={["R", "G", "B"][n]}
                  value={Math.round((v * 31) / 255)}
                  min={0}
                  max={31}
                  onChange={(value) => {
                    if (palette.locked[i]) return;
                    const c = [r, g, b];
                    c[n] = (value * 255) / 31;
                    update((p) => {
                      p.colors[i] = rgb555(...(c as [number, number, number]));
                    });
                  }}
                />
              ))}
            </div>
            <code>
              {hex(palette.colors[i])} · $
              {palette.colors[i].toString(16).padStart(4, "0")}
            </code>
            <Field label={tr("Nom de la couleur", "Color name")}>
              <input
                value={palette.labels[i]}
                onChange={(e) =>
                  update((p) => {
                    p.labels[i] = e.target.value;
                  })
                }
              />
            </Field>
            <Check
              label={tr("Verrouiller", "Lock")}
              value={palette.locked[i]}
              onChange={(v) =>
                update((p) => {
                  p.locked[i] = v;
                })
              }
            />
            <button onClick={swap} disabled={i >= palette.colors.length - 1}>
              {tr(
                "Échanger avec la suivante, rendu conservé",
                "Swap with next, preserve appearance",
              )}
            </button>
            <button
              onClick={() =>
                update((p) => {
                  for (let n = i + 1; n < p.colors.length - 1; n++)
                    if (!p.locked[n]) {
                      const a = rgb(p.colors[i]),
                        b = rgb(p.colors.at(-1)!);
                      p.colors[n] = rgb555(
                        ...(a.map(
                          (v, k) =>
                            v +
                            ((b[k] - v) * (n - i)) / (p.colors.length - 1 - i),
                        ) as [number, number, number]),
                      );
                    }
                })
              }
            >
              {tr("Dégradé jusqu’à la dernière couleur", "Ramp to last color")}
            </button>
          </>
        )}
        <h3>{tr("Animation de palette", "Palette animation")}</h3>
        <Check
          label={tr("Activer le cycle", "Enable cycling")}
          value={!!palette.cycle}
          onChange={(v) =>
            update((p) => {
              p.cycle = v
                ? { start: 1, end: p.colors.length - 1, ticks: 8 }
                : undefined;
            })
          }
        />
        {palette.cycle && (
          <>
            <NumberField
              label={tr("Premier indice", "First index")}
              value={palette.cycle.start}
              min={1}
              max={palette.cycle.end}
              onChange={(v) =>
                update((p) => {
                  p.cycle!.start = v;
                })
              }
            />
            <NumberField
              label={tr("Dernier indice", "Last index")}
              value={palette.cycle.end}
              min={palette.cycle.start}
              max={palette.colors.length - 1}
              onChange={(v) =>
                update((p) => {
                  p.cycle!.end = v;
                })
              }
            />
            <NumberField
              label={tr("Durée en images", "Duration in frames")}
              value={palette.cycle.ticks}
              min={1}
              onChange={(v) =>
                update((p) => {
                  p.cycle!.ticks = v;
                })
              }
            />
          </>
        )}
        <h3>{tr("Utilisée par", "Used by")}</h3>
        {uses(project, palette.id).map((name, n) => (
          <p key={n} className="muted">
            {name}
          </p>
        ))}
      </aside>
    </>
  );
}
