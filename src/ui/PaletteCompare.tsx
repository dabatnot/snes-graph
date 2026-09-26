import { useState } from "react";
import { clone, frameAt, hex, type Project, type Palette } from "../core/model";
import { renderSheet, renderActor } from "../core/render";
import { remapSheetIndices, resourceUses } from "../core/resources";
import { Field, Select, Preview } from "./controls";
import { useTick } from "./Sprites";
import { tr } from "../i18n";

export function PaletteCompare({
  project,
  palette,
  change,
}: {
  project: Project;
  palette: Palette;
  change: (fn: (p: Project) => void) => void;
}) {
  const [other, setOther] = useState(""),
    [asset, setAsset] = useState(project.sheets[0]?.id ?? ""),
    [play, setPlay] = useState(false),
    [anim, setAnim] = useState(""),
    [mapping, setMapping] = useState<number[] | null>(null);
  const tick = useTick(play, project.fps),
    second = project.palettes.find((p) => p.id === other),
    sheet = project.sheets.find((s) => s.id === asset),
    actor = project.actors.find((a) => a.id === asset);
  let preview: Project | undefined,
    error = "";
  if (mapping && sheet)
    try {
      preview = clone(project);
      remapSheetIndices(preview, sheet.id, mapping);
    } catch (e) {
      error = String(e);
    }
  const image = (p: Project, pal: Palette) =>
    sheet
      ? renderSheet(
          p,
          p.sheets.find((s) => s.id === sheet.id)!,
          pal.id,
          tick,
        )
      : renderActor(
          p,
          actor!,
          frameAt(actor!, anim || actor!.animations[0].id, tick),
          { id: "preview", name: "", palettes: { [palette.id]: pal.id } },
          tick,
        );
  const compatible = !!sheet
    ? palette.colors.length >= 1 << sheet.bpp
    : !!actor;
  return (
    <details>
      <summary>{tr("Comparer et remapper", "Compare and remap")}</summary>
      <Select
        label={tr("Comparer avec", "Compare with")}
        value={other}
        options={[
          { value: "", label: tr("Choisir une palette", "Choose a palette") },
          ...project.palettes
            .filter(
              (p) =>
                p.colors.length === palette.colors.length &&
                p.id !== palette.id,
            )
            .map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={setOther}
      />
      <Select
        label={tr("Ressource d’aperçu", "Preview resource")}
        value={asset}
        options={[
          ...project.sheets.filter((s) => 1 << s.bpp <= palette.colors.length),
          ...project.actors,
        ].map((r) => ({ value: r.id, label: r.name }))}
        onChange={(v) => {
          setAsset(v);
          setMapping(null);
          setAnim("");
        }}
      />
      {actor && (
        <Select
          label={tr("Animation", "Animation")}
          value={anim || actor.animations[0].id}
          options={actor.animations.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
          onChange={setAnim}
        />
      )}
      <button onClick={() => setPlay(!play)}>
        {play
          ? tr("Arrêter", "Stop")
          : tr("Lecture synchronisée", "Synchronized playback")}
      </button>
      {compatible && (
        <div className="button-row">
          <figure>
            <figcaption>{palette.name}</figcaption>
            <Preview
              image={image(project, palette)}
              scale={
                sheet
                  ? Math.min(4, 240 / Math.max(sheet.width, sheet.height))
                  : 2
              }
            />
          </figure>
          {second && (
            <figure>
              <figcaption>{second.name}</figcaption>
              <Preview
                image={image(project, second)}
                scale={
                  sheet
                    ? Math.min(4, 240 / Math.max(sheet.width, sheet.height))
                    : 2
                }
              />
            </figure>
          )}
        </div>
      )}
      {second && (
        <table>
          <thead>
            <tr>
              <th>{tr("Indice / rôle", "Index / role")}</th>
              <th>{palette.name}</th>
              <th>{second.name}</th>
            </tr>
          </thead>
          <tbody>
            {palette.colors.map((color, i) => (
              <tr
                key={i}
                style={{
                  background:
                    color !== second.colors[i] ? "#3a3948" : undefined,
                }}
              >
                <td>
                  {i} {palette.labels[i]}
                </td>
                <td>
                  <span
                    style={{
                      background: hex(color),
                      display: "inline-block",
                      width: 16,
                      height: 16,
                    }}
                  />{" "}
                  {hex(color)}
                </td>
                <td>
                  <span
                    style={{
                      background: hex(second.colors[i]),
                      display: "inline-block",
                      width: 16,
                      height: 16,
                    }}
                  />{" "}
                  {hex(second.colors[i])} {second.labels[i]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sheet && compatible && (
        <>
          <p>
            {tr(
              "La comparaison ne modifie aucun pixel. Le remappage ci-dessous change le dessin et tous ses usages.",
              "Comparison changes no pixels. Remapping below changes the drawing and all its uses.",
            )}
          </p>
          <button
            onClick={() =>
              setMapping(Array.from({ length: 1 << sheet.bpp }, (_, i) => i))
            }
          >
            {tr("Remapper les indices…", "Remap indices…")}
          </button>
          {mapping && (
            <>
              <p>
                {resourceUses(project, sheet.id)
                  .map((u) => u.name)
                  .join(", ")}
              </p>
              <div className="color-grid">
                {mapping.map((to, from) => (
                  <Field key={from} label={String(from)}>
                    <input
                      aria-label={`${tr("Remplacer l’indice", "Replace index")} ${from}`}
                      type="number"
                      min={from ? 1 : 0}
                      max={mapping.length - 1}
                      disabled={!from}
                      value={to}
                      onChange={(e) => {
                        const n = e.currentTarget.valueAsNumber;
                        if (Number.isInteger(n))
                          setMapping((m) =>
                            m!.map((v, i) => (i === from ? n : v)),
                          );
                      }}
                    />
                  </Field>
                ))}
              </div>
              {error && <p className="error">{error}</p>}
              {preview && (
                <Preview
                  image={image(preview, palette)}
                  scale={Math.min(4, 240 / Math.max(sheet.width, sheet.height))}
                />
              )}
              <button
                disabled={!preview}
                onClick={() => {
                  change((p) => remapSheetIndices(p, sheet.id, mapping));
                  setMapping(null);
                }}
              >
                {tr("Appliquer aux pixels partagés", "Apply to shared pixels")}
              </button>
              <button onClick={() => setMapping(null)}>
                {tr("Annuler", "Cancel")}
              </button>
            </>
          )}
        </>
      )}
    </details>
  );
}
