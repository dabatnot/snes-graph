import { useRef, useState } from "react";
import {
  makeLayer,
  uid,
  hex,
  fromHex,
  MODES,
  OBJ_SIZES,
  frameAt,
  type Project,
  type Scene,
} from "../core/model";
import { renderScene } from "../core/render";
import { diagnose, type Diagnostic } from "../core/snes";
import { Check, Field, NumberField, Select, Preview } from "./controls";
import { useTick } from "./Sprites";
import { tr } from "../i18n";
export function diagnosticText(d: Diagnostic) {
  const v = d.values;
  return (
    (
      {
        palette: tr(
          "Palette incompatible avec les indices du dessin.",
          "Palette incompatible with graphic indices.",
        ),
        objPalettes: tr(
          `${v.count} palettes de sprites ; maximum 8.`,
          `${v.count} sprite palettes; maximum 8.`,
        ),
        bgPalettes: tr(
          `${v.count} palettes de décor incompatibles avec le format.`,
          `${v.count} background palettes incompatible with format.`,
        ),
        mode: tr(
          `BG${v.layer} attend ${v.bpp} bpp dans ce mode.`,
          `BG${v.layer} requires ${v.bpp} bpp in this mode.`,
        ),
        tiles: tr(
          "Trop de tiles pour cette couche.",
          "Too many tiles for this layer.",
        ),
        objSize: tr(
          `Taille ${v.size} incompatible avec le couple choisi.`,
          `Size ${v.size} incompatible with selected size pair.`,
        ),
        objCount: tr(
          `${v.count} sprites matériels ; maximum 128.`,
          `${v.count} hardware sprites; maximum 128.`,
        ),
        scanline: tr(
          `Ligne ${v.line} : ${v.sprites} sprites, ${v.slivers} portions.`,
          `Line ${v.line}: ${v.sprites} sprites, ${v.slivers} slivers.`,
        ),
        vram: tr(
          `${v.bytes} octets demandés ; VRAM 65536 octets.`,
          `${v.bytes} bytes requested; VRAM 65536 bytes.`,
        ),
        memory: tr(
          `Ressources graphiques : ${v.bytes} octets avant alignement.`,
          `Graphics: ${v.bytes} bytes before alignment.`,
        ),
        channel: tr(
          `Canal HDMA ${v.channel} indisponible (canaux 0 à 7).`,
          `HDMA channel ${v.channel} unavailable (channels 0–7).`,
        ),
        perspectiveChannels: tr(
          "La perspective demande deux canaux HDMA libres.",
          "Perspective needs two free HDMA channels.",
        ),
        mode7map: tr(
          "Le Mode 7 demande une carte de 128 × 128 tiles.",
          "Mode 7 requires a 128 × 128 tile map.",
        ),
      } as Record<string, string>
    )[d.code] ?? d.code
  );
}
export function Scenes({
  project,
  scene,
  change,
}: {
  project: Project;
  scene: Scene;
  change: (fn: (p: Project) => void) => void;
}) {
  const [play, setPlay] = useState(false),
    [scale, setScale] = useState(2),
    [crt, setCrt] = useState(false),
    [selected, setSelected] = useState(""),
    [moved, setMoved] = useState<{ id: string; x: number; y: number } | null>(
      null,
    ),
    [line, setLine] = useState<number | null>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const tick = useTick(play, project.fps),
    edit = (fn: (s: Scene) => void) =>
      change((p) => fn(p.scenes.find((s) => s.id === scene.id)!));
  const diagnostics = diagnose(project, scene, tick);
  const shown = moved
    ? {
        ...scene,
        instances: scene.instances.map((i) =>
          i.id === moved.id ? { ...i, x: moved.x, y: moved.y } : i,
        ),
      }
    : scene;
  const raster = renderScene(project, shown, tick);
  const bounds = shown.instances.map((i) => {
    const a = project.actors.find((a) => a.id === i.actorId)!,
      pieces = frameAt(a, i.animationId, tick)?.pieces ?? [];
    const xs = pieces.map(
        (c) =>
          i.x +
          (i.vx * tick) / project.fps -
          a.originX +
          (i.flipX ? 2 * a.originX - c.x - c.size : c.x),
      ),
      ys = pieces.map(
        (c) => i.y + (i.vy * tick) / project.fps - a.originY + c.y,
      );
    return {
      id: i.id,
      x: Math.min(...xs),
      y: Math.min(...ys),
      right: Math.max(...xs.map((x, n) => x + pieces[n].size)),
      bottom: Math.max(...ys.map((y, n) => y + pieces[n].size)),
    };
  });
  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 256) / r.width,
      y: ((e.clientY - r.top) * scene.height) / r.height,
    };
  };
  return (
    <>
      <div className="work">
        <div className="toolbar">
          <button
            onClick={() => setPlay(!play)}
            className={play ? "active" : ""}
          >
            {play ? "Ⅱ" : "▶"} {tr("Lecture", "Play")}
          </button>
          <button onClick={() => setScale(Math.max(1, scale - 1))}>−</button>
          <span>{scale * 100}%</span>
          <button onClick={() => setScale(Math.min(4, scale + 1))}>＋</button>
          <Check
            label={tr("Simulation CRT", "CRT simulation")}
            value={crt}
            onChange={setCrt}
          />
          <span>
            {project.fps} Hz · {tr("Image", "Frame")} {tick}
          </span>
        </div>
        <div className="scene-stage">
          <div
            className={crt ? "crt scene-canvas" : "scene-canvas"}
            onPointerDown={(e) => {
              if (play) return;
              const p = point(e),
                hit = bounds.find(
                  (b) =>
                    p.x >= b.x && p.x < b.right && p.y >= b.y && p.y < b.bottom,
                );
              setSelected(hit?.id ?? "");
              if (hit) {
                const i = scene.instances.find((i) => i.id === hit.id)!;
                drag.current = {
                  id: i.id,
                  x: p.x,
                  y: p.y,
                  originX: i.x,
                  originY: i.y,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const p = point(e);
              setMoved({
                id: d.id,
                x: Math.round(d.originX + p.x - d.x),
                y: Math.round(d.originY + p.y - d.y),
              });
            }}
            onPointerUp={() => {
              if (moved)
                edit((s) => {
                  const i = s.instances.find((i) => i.id === moved.id)!;
                  i.x = moved.x;
                  i.y = moved.y;
                });
              drag.current = null;
              setMoved(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setMoved(null);
            }}
          >
            <Preview
              image={raster}
              scale={scale}
              label={tr("Aperçu de la scène", "Scene preview")}
            />
            {bounds
              .filter((b) => b.id === selected && Number.isFinite(b.x))
              .map((b) => (
                <div
                  key={b.id}
                  className="scene-selection"
                  style={{
                    left: ((b.x * raster.width) / 256) * scale,
                    top: ((b.y * raster.height) / scene.height) * scale,
                    width: (((b.right - b.x) * raster.width) / 256) * scale,
                    height:
                      (((b.bottom - b.y) * raster.height) / scene.height) *
                      scale,
                  }}
                />
              ))}
            {line !== null && (
              <div
                className="scene-line"
                style={{ top: ((line * raster.height) / scene.height) * scale }}
              />
            )}
          </div>
        </div>
        <div className="diagnostics">
          <h3>{tr("Contraintes de la scène", "Scene constraints")}</h3>
          {diagnostics.map((d, n) => (
            <p key={n} className={d.level}>
              {d.level === "error" ? "!" : "·"} {diagnosticText(d)}
              {d.code === "scanline" && (
                <button
                  onClick={() =>
                    setLine(line === +d.values.line ? null : +d.values.line)
                  }
                >
                  {tr("Localiser", "Locate")}
                </button>
              )}
            </p>
          ))}
        </div>
      </div>
      <aside className="inspector">
        <h3>{tr("Scène", "Scene")}</h3>
        <Field label={tr("Nom", "Name")}>
          <input
            value={scene.name}
            onChange={(e) =>
              edit((s) => {
                s.name = e.target.value;
              })
            }
          />
        </Field>
        <Select
          label={tr("Mode graphique", "Graphics mode")}
          value={scene.mode}
          options={MODES.map((bits, n) => ({
            value: n,
            label: `Mode ${n} · ${bits.join("/")} bpp`,
          }))}
          onChange={(v) =>
            edit((s) => {
              s.mode = +v;
            })
          }
        />
        <Select
          label={tr("Tailles des sprites", "Sprite sizes")}
          value={scene.objSize}
          options={OBJ_SIZES.map(([a, b], n) => ({
            value: n,
            label: `${a} × ${a} / ${b} × ${b}`,
          }))}
          onChange={(v) =>
            edit((s) => {
              s.objSize = +v;
            })
          }
        />
        <Select
          label={tr("Hauteur", "Height")}
          value={scene.height}
          options={[224, 239].map((v) => ({ value: v, label: String(v) }))}
          onChange={(v) =>
            edit((s) => {
              s.height = +v as 224 | 239;
            })
          }
        />
        <Check
          label={tr("Entrelacement", "Interlace")}
          value={scene.interlace}
          onChange={(v) =>
            edit((s) => {
              s.interlace = v;
            })
          }
        />
        <Check
          label={tr("Priorité BG3", "BG3 priority")}
          value={scene.bg3Priority}
          onChange={(v) =>
            edit((s) => {
              s.bg3Priority = v;
            })
          }
        />
        <Check
          label={tr("Couleurs directes", "Direct color")}
          value={scene.directColor}
          onChange={(v) =>
            edit((s) => {
              s.directColor = v;
            })
          }
        />
        <Field label={tr("Couleur de fond", "Backdrop")}>
          <input
            type="color"
            value={hex(scene.backdrop)}
            onChange={(e) =>
              edit((s) => {
                s.backdrop = fromHex(e.target.value);
              })
            }
          />
        </Field>
        <div className="number-row">
          <NumberField
            label={tr("Caméra X", "Camera X")}
            value={scene.cameraX}
            onChange={(v) =>
              edit((s) => {
                s.cameraX = v;
              })
            }
          />
          <NumberField
            label={tr("Caméra Y", "Camera Y")}
            value={scene.cameraY}
            onChange={(v) =>
              edit((s) => {
                s.cameraY = v;
              })
            }
          />
        </div>
        <h3>{tr("Couches de fond", "Background layers")}</h3>
        {scene.layers.map((l, n) => (
          <details key={n} open>
            <summary>
              BG{n + 1} · {project.maps.find((m) => m.id === l.mapId)?.name}
            </summary>
            <Select
              label={tr("Carte", "Map")}
              value={l.mapId}
              options={project.maps.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].mapId = v;
                })
              }
            />
            <Check
              label={tr("Visible", "Visible")}
              value={l.enabled}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].enabled = v;
                })
              }
            />
            <div className="number-row">
              <NumberField
                label="X"
                value={l.x}
                onChange={(v) =>
                  edit((s) => {
                    s.layers[n].x = v;
                  })
                }
              />
              <NumberField
                label="Y"
                value={l.y}
                onChange={(v) =>
                  edit((s) => {
                    s.layers[n].y = v;
                  })
                }
              />
            </div>
            <NumberField
              label={tr("Défilement X / seconde", "Scroll X / second")}
              value={l.speedX}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].speedX = v;
                })
              }
            />
            <NumberField
              label={tr("Défilement Y / seconde", "Scroll Y / second")}
              value={l.speedY}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].speedY = v;
                })
              }
            />
            <Check
              label={tr("Écran principal", "Main screen")}
              value={l.main}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].main = v;
                })
              }
            />
            <Check
              label={tr("Écran secondaire", "Sub screen")}
              value={l.sub}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].sub = v;
                })
              }
            />
            <Check
              label={tr("Mélange des couleurs", "Color math")}
              value={l.math}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].math = v;
                })
              }
            />
            <NumberField
              label={tr("Mosaïque", "Mosaic")}
              value={l.mosaic}
              min={1}
              max={16}
              onChange={(v) =>
                edit((s) => {
                  s.layers[n].mosaic = v;
                })
              }
            />
            <button
              onClick={() =>
                edit((s) => {
                  s.layers.splice(n, 1);
                })
              }
            >
              − BG{n + 1}
            </button>
          </details>
        ))}
        <button
          disabled={!project.maps.length || scene.layers.length >= 4}
          onClick={() =>
            edit((s) => {
              s.layers.push(makeLayer(project.maps[0].id));
            })
          }
        >
          ＋ {tr("Couche", "Layer")}
        </button>
        <h3>{tr("Personnages", "Characters")}</h3>
        {scene.instances.map((i, n) => {
          const a = project.actors.find((a) => a.id === i.actorId)!;
          return (
            <details key={i.id} open={selected === i.id}>
              <summary>
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    setSelected(selected === i.id ? "" : i.id);
                  }}
                >
                  {n + 1} · {a.name}
                </span>
              </summary>
              <Select
                label={tr("Animation", "Animation")}
                value={i.animationId}
                options={a.animations.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
                onChange={(v) =>
                  edit((s) => {
                    s.instances[n].animationId = v;
                  })
                }
              />
              <Select
                label={tr("Variante", "Variant")}
                value={i.variantId}
                options={[
                  { value: "", label: tr("Original", "Original") },
                  ...a.variants.map((v) => ({ value: v.id, label: v.name })),
                ]}
                onChange={(v) =>
                  edit((s) => {
                    s.instances[n].variantId = v;
                  })
                }
              />
              {(["x", "y", "vx", "vy"] as const).map((k) => (
                <NumberField
                  key={k}
                  label={k}
                  value={i[k]}
                  onChange={(v) =>
                    edit((s) => {
                      s.instances[n][k] = v;
                    })
                  }
                />
              ))}
              <Check
                label={tr("Miroir", "Flip")}
                value={i.flipX}
                onChange={(v) =>
                  edit((s) => {
                    s.instances[n].flipX = v;
                  })
                }
              />
              <button
                onClick={() =>
                  edit((s) => {
                    s.instances.push({ ...i, id: uid(), x: i.x + 32 });
                  })
                }
              >
                {tr("Dupliquer", "Duplicate")}
              </button>
              <button
                onClick={() =>
                  edit((s) => {
                    s.instances.splice(n, 1);
                  })
                }
              >
                {tr("Supprimer", "Delete")}
              </button>
            </details>
          );
        })}
        {project.actors.map((a) => (
          <button
            key={a.id}
            onClick={() =>
              edit((s) => {
                s.instances.push({
                  id: uid(),
                  actorId: a.id,
                  animationId: a.animations[0].id,
                  variantId: "",
                  x: 128,
                  y: 112,
                  vx: 0,
                  vy: 0,
                  flipX: false,
                });
              })
            }
          >
            ＋ {a.name}
          </button>
        ))}
        <h3>{tr("Effets", "Effects")}</h3>
        <details>
          <summary>{tr("Placement des palettes", "Palette placement")}</summary>
          {(scene.paletteSlots ?? []).map((a, n) => (
            <div key={n}>
              <Select
                label={tr("Palette", "Palette")}
                value={a.paletteId}
                options={project.palettes.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                onChange={(v) =>
                  edit((s) => {
                    s.paletteSlots![n].paletteId = v;
                  })
                }
              />
              <Select
                label={tr("Destination", "Destination")}
                value={a.layer}
                options={["BG1", "BG2", "BG3", "BG4", "OBJ"].map(
                  (label, value) => ({ value, label }),
                )}
                onChange={(v) =>
                  edit((s) => {
                    s.paletteSlots![n].layer = +v;
                  })
                }
              />
              <NumberField
                label={tr("Emplacement", "Slot")}
                value={a.slot}
                min={0}
                max={7}
                onChange={(v) =>
                  edit((s) => {
                    s.paletteSlots![n].slot = v;
                  })
                }
              />
              <button
                onClick={() =>
                  edit((s) => {
                    s.paletteSlots!.splice(n, 1);
                  })
                }
              >
                {tr("Libérer", "Release")}
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              edit((s) => {
                s.paletteSlots ??= [];
                s.paletteSlots.push({
                  paletteId: project.palettes[0].id,
                  layer: 4,
                  slot: 0,
                });
              })
            }
          >
            ＋ {tr("Réserver un emplacement", "Reserve a slot")}
          </button>
        </details>
        <Select
          label={tr("Mélange", "Blend")}
          value={scene.math}
          options={[
            { value: "none", label: tr("Aucun", "None") },
            { value: "add", label: tr("Addition", "Add") },
            { value: "subtract", label: tr("Soustraction", "Subtract") },
          ]}
          onChange={(v) =>
            edit((s) => {
              s.math = v as Scene["math"];
            })
          }
        />
        <Check
          label={tr("Demi-intensité", "Half intensity")}
          value={scene.half}
          onChange={(v) =>
            edit((s) => {
              s.half = v;
            })
          }
        />
        <Check
          label={tr("Mélanger les sprites", "Blend sprites")}
          value={scene.objMath}
          onChange={(v) =>
            edit((s) => {
              s.objMath = v;
            })
          }
        />
        <Field label={tr("Couleur fixe", "Fixed color")}>
          <input
            type="color"
            value={hex(scene.fixedColor)}
            onChange={(e) =>
              edit((s) => {
                s.fixedColor = fromHex(e.target.value);
              })
            }
          />
        </Field>
        {scene.mode === 7 && (
          <>
            <Check
              label="EXTBG"
              value={scene.extbg}
              onChange={(v) =>
                edit((s) => {
                  s.extbg = v;
                })
              }
            />
            {(["angle", "scale", "perspective", "horizon"] as const).map(
              (k) => (
                <NumberField
                  key={k}
                  label={k}
                  value={scene[k]}
                  step={k === "scale" ? 0.1 : 1}
                  min={k === "scale" ? 0.1 : -32768}
                  onChange={(v) =>
                    edit((s) => {
                      s[k] = v;
                    })
                  }
                />
              ),
            )}
          </>
        )}
        {[2, 4, 6].includes(scene.mode) &&
          (["offsetX", "offsetY"] as const).map((k) => (
            <Field key={k} label={k}>
              <input
                value={scene[k].join(",")}
                onChange={(e) => {
                  const a = e.target.value
                    .split(",")
                    .map(Number)
                    .map((v) => (Number.isFinite(v) ? Math.trunc(v) : 0));
                  edit((s) => {
                    s[k] = a;
                  });
                }}
              />
            </Field>
          ))}
        {scene.effects.map((e, n) => (
          <details key={e.id} open>
            <summary>{e.kind}</summary>
            <Check
              label={tr("Actif", "Enabled")}
              value={e.enabled}
              onChange={(v) =>
                edit((s) => {
                  s.effects[n].enabled = v;
                })
              }
            />
            <NumberField
              label={tr("Canal HDMA", "HDMA channel")}
              value={e.channel}
              min={0}
              max={7}
              onChange={(v) =>
                edit((s) => {
                  s.effects[n].channel = v;
                })
              }
            />
            {e.kind === "gradient"
              ? (["color", "endColor"] as const).map((k, j) => (
                  <Field
                    key={k}
                    label={j ? tr("Fin", "End") : tr("Début", "Start")}
                  >
                    <input
                      type="color"
                      value={hex(e[k])}
                      onChange={(ev) =>
                        edit((s) => {
                          s.effects[n][k] = fromHex(ev.target.value);
                        })
                      }
                    />
                  </Field>
                ))
              : (e.kind === "wave"
                  ? (["layer", "amplitude", "period", "speed"] as const)
                  : (["centerX", "centerY", "radius"] as const)
                ).map((k) => (
                  <NumberField
                    key={k}
                    label={k}
                    value={e[k]}
                    min={
                      k === "period"
                        ? 1
                        : k === "radius" || k === "layer"
                          ? 0
                          : -32768
                    }
                    max={k === "layer" ? 3 : k === "radius" ? 4096 : 32767}
                    onChange={(v) =>
                      edit((s) => {
                        s.effects[n][k] = v;
                      })
                    }
                  />
                ))}
            <button
              onClick={() =>
                edit((s) => {
                  s.effects.splice(n, 1);
                })
              }
            >
              {tr("Supprimer", "Delete")}
            </button>
          </details>
        ))}
        <div className="button-row">
          {(["gradient", "wave", "iris"] as const).map((kind, n) => (
            <button
              key={kind}
              onClick={() =>
                edit((s) => {
                  s.effects.push({
                    id: uid(),
                    kind,
                    enabled: true,
                    channel: s.effects.length,
                    layer: 0,
                    amplitude: 4,
                    period: 32,
                    speed: 2,
                    color: fromHex("#28366d"),
                    endColor: fromHex("#d59188"),
                    centerX: 128,
                    centerY: 112,
                    radius: 80,
                  });
                })
              }
            >
              ＋{" "}
              {
                [
                  tr("Dégradé", "Gradient"),
                  tr("Vague", "Wave"),
                  tr("Iris", "Iris"),
                ][n]
              }
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
