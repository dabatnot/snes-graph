import { useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { fixRomChecksum } from "../core/demo";
import { zipSync } from "fflate";
import { defaultExport, diagnose, buildTiles } from "../core/snes";
import { saveBytes } from "../platform";
import type { Project, ExportSet } from "../core/model";
import { uid } from "../core/model";
import { Check, Field, NumberField, Select } from "./controls";
import { diagnosticText } from "./Scenes";
import { tr } from "../i18n";
export function Exports({
  project,
  change,
  report,
}: {
  project: Project;
  change: (f: (p: Project) => void) => void;
  report: (s: string) => void;
}) {
  const [selected, setSelected] = useState(project.exports[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [ticks, setTicks] = useState(project.fps * 2),
    [ca65, setCa65] = useState(
      localStorage.getItem("snes-graph-ca65") ?? "ca65",
    ),
    [ld65, setLd65] = useState(
      localStorage.getItem("snes-graph-ld65") ?? "ld65",
    ),
    [emulator, setEmulator] = useState(
      localStorage.getItem("snes-graph-emulator") ?? "",
    );
  const abort = useRef<AbortController | null>(null);
  const opt =
    project.exports.find((e) => e.id === selected) ?? defaultExport(project);
  const scene = project.scenes.find((s) => s.id === opt.sceneId),
    ds = diagnose(project, scene);
  const edit = (f: (e: ExportSet) => void) =>
    change((p) => {
      let e = p.exports.find((e) => e.id === selected);
      if (!e) {
        e = {
          ...defaultExport(p),
          id: uid(),
          name: tr("Export principal", "Main export"),
        };
        p.exports.push(e);
        setSelected(e.id);
      }
      f(e);
    });
  const run = async (demo = false, launch = false) => {
    setBusy(true);
    abort.current = new AbortController();
    try {
      const { runExport } = await import("../worker-client");
      const files = await runExport(
        project,
        opt,
        abort.current.signal,
        demo,
        ticks,
      );
      if (demo && isTauri()) {
        const rom = fixRomChecksum(
          Uint8Array.from(
            await invoke<number[]>("build_demo", {
              files: Object.fromEntries(
                Object.entries(files).map(([k, v]) => [k, Array.from(v)]),
              ),
              ca65,
              ld65,
            }),
          ),
        );
        if (launch)
          await invoke("launch_emulator", {
            executable: emulator,
            rom: Array.from(rom),
          });
        else await saveBytes(rom, project.name + ".sfc");
        report(
          launch
            ? tr("ROM ouverte dans l’émulateur", "ROM opened in emulator")
            : tr("ROM générée", "ROM generated"),
        );
        return;
      }
      const result = await saveBytes(
        zipSync(
          Object.fromEntries(
            Object.entries(files).map(([name, data]) => [
              name,
              [data, { mtime: new Date(2000, 0, 1) }],
            ]),
          ),
        ),
        project.name + (demo ? ".ca65-demo.zip" : ".snes-export.zip"),
      );
      if (result) report(tr("Export enregistré", "Export saved"));
    } catch (e) {
      report(String(e));
    } finally {
      setBusy(false);
    }
  };
  const resources = [
    ["paletteIds", "palettes", tr("Palettes", "Palettes")],
    ["sheetIds", "sheets", tr("Dessins", "Graphics")],
    ["actorIds", "actors", tr("Personnages", "Characters")],
    ["mapIds", "maps", tr("Cartes", "Maps")],
  ] as const;
  return (
    <>
      <div className="work export-work">
        <div className="document-title">
          <h2>{tr("Exporter pour la SNES", "Export for SNES")}</h2>
          <button
            className="primary"
            disabled={busy || ds.some((d) => d.level === "error")}
            onClick={() => run()}
          >
            {busy
              ? tr("Export en cours…", "Exporting…")
              : tr("Exporter les ressources", "Export assets")}
          </button>
        </div>
        {busy && (
          <button onClick={() => abort.current?.abort()}>
            {tr("Annuler", "Cancel")}
          </button>
        )}
        <p>
          {tr(
            "Tiles, palettes, cartes, métasprites, animations et symboles ca65 réunis dans une archive.",
            "Tiles, palettes, maps, metasprites, animations and ca65 symbols in one archive.",
          )}
        </p>
        <div className="export-columns">
          {resources.map(([key, group, label]) => (
            <section key={key}>
              <h3>{label}</h3>
              {project[group].map((r) => (
                <Check
                  key={r.id}
                  label={r.name}
                  value={opt[key].includes(r.id)}
                  onChange={(v) =>
                    edit((e) => {
                      e[key] = v
                        ? [...e[key], r.id]
                        : e[key].filter((id) => id !== r.id);
                    })
                  }
                />
              ))}
            </section>
          ))}
        </div>
        <h3>{tr("Diagnostic", "Diagnostics")}</h3>
        {ds.map((d, n) => (
          <p key={n} className={d.level}>
            {diagnosticText(d)}
          </p>
        ))}
        <h3>{tr("Organisation des fichiers", "File organization")}</h3>
        <pre>
          palettes/*.pal{`\n`}tiles/*.chr{`\n`}maps/*.map{`\n`}maps/*.collision
          {`\n`}sprites.chr{`\n`}assets.inc{`\n`}manifest.json
        </pre>
        <h3>{tr("ROM de démonstration", "Demo ROM")}</h3>
        <p>
          {tr(
            "Une boucle de la scène pour vérifier les ressources dans votre émulateur.",
            "A scene loop to inspect exported resources in your emulator.",
          )}
        </p>
        <NumberField
          label={tr("Durée en images console", "Duration in console frames")}
          value={ticks}
          min={1}
          max={600}
          onChange={setTicks}
        />
        <div className="button-row">
          <button disabled={busy || !scene} onClick={() => run(true)}>
            {isTauri()
              ? tr("Générer la ROM", "Generate ROM")
              : tr("Exporter le projet ca65", "Export ca65 project")}
          </button>
          {isTauri() && (
            <button
              disabled={busy || !scene || !emulator}
              onClick={() => run(true, true)}
            >
              {tr("Ouvrir dans l’émulateur", "Open in emulator")}
            </button>
          )}
        </div>
        {isTauri() && (
          <details>
            <summary>
              {tr(
                "Outils de compilation et émulateur",
                "Compiler and emulator",
              )}
            </summary>
            {(
              [
                ["ca65", ca65, setCa65],
                ["ld65", ld65, setLd65],
                ["emulator", emulator, setEmulator],
              ] as const
            ).map(([key, value, set]) => (
              <Field
                key={key}
                label={
                  key === "emulator"
                    ? tr("Chemin de l’émulateur", "Emulator path")
                    : key
                }
              >
                <input
                  value={value}
                  onChange={(e) => {
                    set(e.target.value);
                    localStorage.setItem("snes-graph-" + key, e.target.value);
                  }}
                />
              </Field>
            ))}
          </details>
        )}
      </div>
      <aside className="inspector">
        <h3>{tr("Ensemble d’export", "Export set")}</h3>
        <Select
          label={tr("Ensemble", "Set")}
          value={selected}
          options={[
            { value: "", label: tr("Toutes les ressources", "All assets") },
            ...project.exports.map((e) => ({ value: e.id, label: e.name })),
          ]}
          onChange={setSelected}
        />
        <Field label={tr("Nom", "Name")}>
          <input
            value={opt.name}
            onChange={(ev) =>
              edit((e) => {
                e.name = ev.target.value;
              })
            }
          />
        </Field>
        <Select
          label={tr("Scène de référence", "Reference scene")}
          value={opt.sceneId}
          options={[
            { value: "", label: tr("Aucune", "None") },
            ...project.scenes.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={(v) =>
            edit((e) => {
              e.sceneId = v;
            })
          }
        />
        <h3>{tr("Optimisation de l’export", "Export optimization")}</h3>
        <Check
          label={tr("Dédupliquer les tiles", "Deduplicate tiles")}
          value={opt.deduplicate}
          onChange={(v) =>
            edit((e) => {
              e.deduplicate = v;
            })
          }
        />
        <Check
          label={tr("Réutiliser les miroirs", "Reuse flipped tiles")}
          value={opt.flips}
          onChange={(v) =>
            edit((e) => {
              e.flips = v;
            })
          }
        />
        <NumberField
          label={tr("Tiles réservées en tête", "Reserved leading tiles")}
          value={opt.reservedTiles}
          min={0}
          max={1023}
          onChange={(v) =>
            edit((e) => {
              e.reservedTiles = v;
            })
          }
        />
        {opt.sheetIds.map((id) => {
          const s = project.sheets.find((s) => s.id === id);
          if (!s) return null;
          const b = buildTiles(project, id, opt);
          return (
            <p key={id}>
              {s.name} : {(s.width * s.height) / 64} → {b.pixels.length / 64}{" "}
              tiles
            </p>
          );
        })}
        <p className="muted">
          {tr(
            "L’optimisation de l’export conserve les ressources éditables indépendantes.",
            "Export optimization preserves independent editable resources.",
          )}
        </p>
      </aside>
    </>
  );
}
