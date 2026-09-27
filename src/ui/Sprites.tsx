import { AnimationTimeline } from "./AnimationTimeline";
import { copyGroupPlacement } from "../core/animation-edit";
import { useEffect, useRef, useState } from "react";
import {
  clone,
  frameAt,
  makePose,
  uid,
  type Project,
  type Actor,
  type Piece,
  type Pose,
} from "../core/model";
import { renderActor } from "../core/render";
import { pixel } from "../core/pixels";
import { Check, Field, NumberField, Select, Preview } from "./controls";
import { tr } from "../i18n";
export function useTick(play: boolean, fps: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!play) {
      setTick(0);
      return;
    }
    let id = 0;
    const start = performance.now();
    const run = (now: number) => {
      setTick(Math.floor(((now - start) * fps) / 1000));
      id = requestAnimationFrame(run);
    };
    id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [play, fps]);
  return tick;
}
export function Sprites({
  project,
  actor,
  change,
  onEditSheet,
}: {
  project: Project;
  actor: Actor;
  change: (fn: (p: Project) => void) => void;
  onEditSheet: (id: string) => void;
}) {
  const [poseIndex, setPose] = useState(0),
    [animIndex, setAnim] = useState(0),
    [variantId, setVariant] = useState(""),
    [pieceId, setPiece] = useState(""),
    [selectedPieces, setSelectedPieces] = useState<string[]>([]),
    [play, setPlay] = useState(false),
    [onion, setOnion] = useState(false),
    [compare, setCompare] = useState(false);
  const [rangeSelection, setRangeSelection] = useState<{
    animationId: string;
    range: [number, number];
  } | null>(null);
  const [targetPoses, setTargetPoses] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [dragMarker, setDragMarker] = useState<{
    kind: "origin" | "anchor" | "box" | "box-size";
    index: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [dragPose, setDragPose] = useState<Pose | null>(null),
    [snap, setSnap] = useState(1);
  const [sliceSheet, setSliceSheet] = useState(
      project.sheets.find((s) => s.bpp === 4)?.id ?? "",
    ),
    [sliceSize, setSliceSize] = useState(16);
  const dragging = useRef<{
    x: number;
    y: number;
    piece: Piece;
    pose: Pose;
    dx: number;
    dy: number;
  } | null>(null);
  const tick = useTick(play, project.fps);
  useEffect(() => {
    setPose(0);
    setAnim(0);
    setVariant("");
    setPiece("");
    setPlay(false);
  }, [actor.id]);
  const animation = actor.animations[animIndex] ?? actor.animations[0];
  const playRange =
    rangeSelection?.animationId === animation?.id
      ? rangeSelection!.range
      : null;
  const setPlayRange = (range: [number, number] | null) =>
    setRangeSelection(range && { animationId: animation.id, range });
  const pose =
      dragPose ??
      (play
        ? frameAt(actor, animation?.id ?? "", tick, playRange)
        : actor.poses[Math.min(poseIndex, actor.poses.length - 1)]),
    variant = actor.variants.find((v) => v.id === variantId),
    piece = pose?.pieces.find((c) => c.id === pieceId);
  const edit = (fn: (a: Actor) => void) =>
    change((p) => fn(p.actors.find((a) => a.id === actor.id)!));
  const editPose = (fn: (p: Pose) => void) =>
    edit((a) => {
      const target = a.poses.find((p) => p.id === pose?.id);
      if (target) fn(target);
    });
  const editAnimation = (fn: (a: Actor["animations"][number]) => void) =>
    edit((a) => {
      const target = a.animations.find((v) => v.id === animation?.id);
      if (target) fn(target);
    });
  const selectedIds = selectedPieces.filter((id) =>
    pose?.pieces.some((c) => c.id === id),
  );
  const editPiece = (fn: (c: Piece) => void) =>
    edit((a) => {
      const c = a.poses
        .find((p) => p.id === pose?.id)
        ?.pieces.find((c) => c.id === pieceId);
      if (c) fn(c);
    });
  const addPiece = () => {
    const s = project.sheets.find((s) => s.bpp === 4);
    if (!s) return;
    const c: Piece = {
      id: uid(),
      sheetId: s.id,
      sx: 0,
      sy: 0,
      size: 8,
      x: 0,
      y: 0,
      paletteId: s.paletteId,
      flipX: false,
      flipY: false,
      priority: 2,
      group: "",
    };
    editPose((p) => p.pieces.push(c));
    setPiece(c.id);
  };
  return (
    <>
      <div className="work sprite-work">
        <div className="toolbar">
          <button
            className={play ? "active" : ""}
            onClick={() => setPlay(!play)}
          >
            {play ? "Ⅱ" : "▶"} {tr("Lecture", "Play")}
          </button>
          <Select
            label={tr("Animation", "Animation")}
            value={animation?.id ?? ""}
            options={actor.animations.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
            onChange={(id) => {
              setAnim(actor.animations.findIndex((a) => a.id === id));
              setPlayRange(null);
            }}
          />
          <Select
            label={tr("Variante", "Variant")}
            value={variantId}
            options={[
              { value: "", label: tr("Original", "Original") },
              ...actor.variants.map((v) => ({ value: v.id, label: v.name })),
            ]}
            onChange={setVariant}
          />
          <Check
            label={tr("Pelure d’oignon", "Onion skin")}
            value={onion}
            onChange={setOnion}
          />
          <Check
            label={tr("Comparer", "Compare")}
            value={compare}
            onChange={setCompare}
          />
        </div>
        <div className="sprite-stage">
          {compare ? (
            [undefined, ...actor.variants].map((v, n) => (
              <div key={n}>
                <Preview
                  image={renderActor(project, actor, pose, v, tick)}
                  scale={2}
                />
                <p>{v?.name ?? tr("Original", "Original")}</p>
              </div>
            ))
          ) : (
            <div
              className="sprite-canvas"
              onPointerDown={(e) => {
                if (play || e.target instanceof HTMLButtonElement) return;
                const r = e.currentTarget.getBoundingClientRect();
                selectionStart.current = {
                  x: (e.clientX - r.left) / 3,
                  y: (e.clientY - r.top) / 3,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                setMarquee({ ...selectionStart.current, width: 0, height: 0 });
              }}
              onPointerMove={(e) => {
                const start = selectionStart.current;
                if (!start) return;
                const r = e.currentTarget.getBoundingClientRect(),
                  x = (e.clientX - r.left) / 3,
                  y = (e.clientY - r.top) / 3;
                setMarquee({
                  x: Math.min(x, start.x),
                  y: Math.min(y, start.y),
                  width: Math.abs(x - start.x),
                  height: Math.abs(y - start.y),
                });
              }}
              onPointerUp={() => {
                if (marquee) {
                  const ids = (pose?.pieces ?? [])
                    .filter((c) => {
                      const x = 64 - actor.originX + c.x,
                        y = 80 - actor.originY + c.y;
                      return (
                        x < marquee.x + marquee.width &&
                        x + c.size > marquee.x &&
                        y < marquee.y + marquee.height &&
                        y + c.size > marquee.y
                      );
                    })
                    .map((c) => c.id);
                  setSelectedPieces(ids);
                  setPiece(ids.at(-1) ?? "");
                }
                selectionStart.current = null;
                setMarquee(null);
              }}
            >
              {marquee && (
                <div
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: 5,
                    border: "1px dashed white",
                    left: marquee.x * 3,
                    top: marquee.y * 3,
                    width: marquee.width * 3,
                    height: marquee.height * 3,
                  }}
                />
              )}
              {onion && poseIndex > 0 && (
                <div className="onion">
                  <Preview
                    image={renderActor(
                      project,
                      actor,
                      actor.poses[poseIndex - 1],
                      variant,
                      tick,
                    )}
                    scale={3}
                  />
                </div>
              )}
              <Preview
                image={renderActor(project, actor, pose, variant, tick)}
                scale={3}
              />
              {!play &&
                pose?.boxes.map((b, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      pointerEvents: "none",
                      zIndex: 3,
                      left: (64 - actor.originX + b.x) * 3,
                      top: (80 - actor.originY + b.y) * 3,
                      width: b.width * 3,
                      height: b.height * 3,
                      border: "1px solid #ffc857",
                    }}
                  />
                ))}
              {!play &&
                pose &&
                [
                  {
                    kind: "origin" as const,
                    index: 0,
                    x: 64,
                    y: 80,
                    width: 5,
                    height: 5,
                    name: tr("Origine", "Origin"),
                  },
                  ...pose.anchors.map((a, index) => ({
                    kind: "anchor" as const,
                    index,
                    x: 64 - actor.originX + a.x,
                    y: 80 - actor.originY + a.y,
                    width: 4,
                    height: 4,
                    name: a.name,
                  })),
                  ...pose.boxes.flatMap((b, index) => [
                    {
                      kind: "box" as const,
                      index,
                      x: 64 - actor.originX + b.x,
                      y: 80 - actor.originY + b.y,
                      width: 4,
                      height: 4,
                      name: tr("Déplacer ", "Move ") + b.name,
                    },
                    {
                      kind: "box-size" as const,
                      index,
                      x: 64 - actor.originX + b.x + b.width,
                      y: 80 - actor.originY + b.y + b.height,
                      width: 4,
                      height: 4,
                      name: tr("Taille ", "Size ") + b.name,
                    },
                  ]),
                ].map((m) => (
                  <button
                    key={m.kind + m.index}
                    title={m.name}
                    aria-label={m.name}
                    style={{
                      position: "absolute",
                      zIndex: 4,
                      left:
                        (m.x +
                          (dragMarker?.kind === m.kind &&
                          dragMarker.index === m.index
                            ? dragMarker.dx
                            : 0)) *
                        3,
                      top:
                        (m.y +
                          (dragMarker?.kind === m.kind &&
                          dragMarker.index === m.index
                            ? dragMarker.dy
                            : 0)) *
                        3,
                      width: m.width * 3,
                      height: m.height * 3,
                      minWidth: 0,
                      padding: 0,
                      background: "#ffc857",
                      border: "1px solid #ffc857",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragMarker({
                        ...m,
                        x: e.clientX,
                        y: e.clientY,
                        dx: 0,
                        dy: 0,
                      });
                    }}
                    onPointerMove={(e) => {
                      if (dragMarker)
                        setDragMarker(
                          (d) =>
                            d && {
                              ...d,
                              dx: Math.round((e.clientX - d.x) / 3),
                              dy: Math.round((e.clientY - d.y) / 3),
                            },
                        );
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      const d = dragMarker;
                      if (d && (d.dx || d.dy))
                        edit((a) => {
                          const p = a.poses.find((p) => p.id === pose.id)!;
                          if (d.kind === "origin") {
                            a.originX += d.dx;
                            a.originY += d.dy;
                          } else if (d.kind === "anchor") {
                            p.anchors[d.index].x += d.dx;
                            p.anchors[d.index].y += d.dy;
                          } else if (d.kind === "box") {
                            p.boxes[d.index].x += d.dx;
                            p.boxes[d.index].y += d.dy;
                          } else {
                            p.boxes[d.index].width = Math.max(
                              1,
                              p.boxes[d.index].width + d.dx,
                            );
                            p.boxes[d.index].height = Math.max(
                              1,
                              p.boxes[d.index].height + d.dy,
                            );
                          }
                        });
                      setDragMarker(null);
                    }}
                    onPointerCancel={() => setDragMarker(null)}
                  />
                ))}
              {!play &&
                pose?.pieces.map((c) => (
                  <button
                    title={c.group || tr("Pièce", "Piece")}
                    aria-label={`${tr("Pièce", "Piece")} ${pose.pieces.indexOf(c) + 1}`}
                    key={c.id}
                    className={`piece-overlay ${selectedIds.includes(c.id) || c.id === pieceId ? "selected" : ""}`}
                    style={{
                      left: (64 - actor.originX + c.x) * 3,
                      top: (80 - actor.originY + c.y) * 3,
                      width: c.size * 3,
                      height: c.size * 3,
                    }}

                    onDoubleClick={() => onEditSheet(c.sheetId)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setPiece(c.id);
                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        setSelectedPieces((ids) =>
                          ids.includes(c.id)
                            ? ids.filter((id) => id !== c.id)
                            : [...ids, c.id],
                        );
                        return;
                      }
                      if (!selectedIds.includes(c.id))
                        setSelectedPieces([c.id]);
                      dragging.current = {
                        x: e.clientX,
                        y: e.clientY,
                        piece: c,
                        pose: clone(pose),
                        dx: 0,
                        dy: 0,
                      };
                    }}
                    onPointerMove={(e) => {
                      const d = dragging.current;
                      if (!d) return;
                      d.dx = Math.round((e.clientX - d.x) / 3 / snap) * snap;
                      d.dy = Math.round((e.clientY - d.y) / 3 / snap) * snap;
                      const next = clone(d.pose);
                      for (const pc of next.pieces)
                        if (
                          pc.id === d.piece.id ||
                          selectedIds.includes(pc.id) ||
                          (d.piece.group && pc.group === d.piece.group)
                        ) {
                          pc.x += d.dx;
                          pc.y += d.dy;
                        }
                      setDragPose(next);
                    }}
                    onPointerUp={() => {
                      const d = dragging.current;
                      if (d && (d.dx || d.dy))
                        edit((a) => {
                          const pos = a.poses.find((p) => p.id === d.pose.id)!;
                          for (const pc of pos.pieces)
                            if (
                              pc.id === d.piece.id ||
                              selectedIds.includes(pc.id) ||
                              (d.piece.group && pc.group === d.piece.group)
                            ) {
                              pc.x += d.dx;
                              pc.y += d.dy;
                            }
                        });
                      dragging.current = null;
                      setDragPose(null);
                    }}
                    onPointerCancel={() => {
                      dragging.current = null;
                      setDragPose(null);
                    }}
                  />
                ))}
            </div>
          )}
        </div>
        <div className="timeline">
          <div className="timeline-head">
            <h3>{tr("Poses", "Poses")}</h3>
            {pose && (
              <input
                aria-label={tr("Nom de la pose", "Pose name")}
                value={pose.name}
                onChange={(e) =>
                  edit((a) => {
                    a.poses.find((f) => f.id === pose.id)!.name =
                      e.target.value;
                  })
                }
              />
            )}
            <button
              onClick={() => {
                const cp = pose ? clone(pose) : makePose();
                cp.id = uid();
                cp.name = tr("Pose", "Pose") + " " + (actor.poses.length + 1);
                cp.pieces.forEach((c) => {
                  c.id = uid();
                });
                edit((a) => {
                  a.poses.push(cp);
                });
                setPose(actor.poses.length);
                setPlay(false);
              }}
            >
              ＋ {tr("Dupliquer la pose", "Duplicate pose")}
            </button>
            <button
              disabled={
                !pose ||
                actor.poses.length < 2 ||
                actor.animations.some((a) =>
                  a.frames.some((f) => f.poseId === pose.id),
                )
              }
              title={tr(
                "Retirer la pose des animations avant de la supprimer.",
                "Remove the pose from animations before deleting it.",
              )}
              onClick={() => {
                edit((a) => {
                  a.poses = a.poses.filter((f) => f.id !== pose!.id);
                });
                setPose(0);
              }}
            >
              {tr("Supprimer la pose", "Delete pose")}
            </button>
          </div>
          <div className="frames">
            {actor.poses.map((f, i) => (
              <button
                key={f.id}
                className={f.id === pose?.id ? "selected" : ""}
                onClick={() => {
                  setPose(i);
                  setPlay(false);
                }}
              >
                <Preview
                  image={renderActor(project, actor, f, variant)}
                  scale={0.6}
                />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          {animation && (
            <AnimationTimeline
              key={animation.id}
              actor={actor}
              animation={animation}
              fps={project.fps}
              edit={editAnimation}
              tick={tick}
              playing={play}
              onSeek={(id) => {
                setPose(actor.poses.findIndex((p) => p.id === id));
                setPlay(false);
              }}
              range={playRange}
              onRange={setPlayRange}
            />
          )}
        </div>
      </div>
      <aside className="inspector">
        <h3>{tr("Personnage", "Character")}</h3>
        <Field label={tr("Nom", "Name")}>
          <input
            value={actor.name}
            onChange={(e) =>
              edit((a) => {
                a.name = e.target.value;
              })
            }
          />
        </Field>
        <div className="number-row">
          <NumberField
            label={tr("Origine X", "Origin X")}
            value={actor.originX}
            onChange={(v) =>
              edit((a) => {
                a.originX = v;
              })
            }
          />
          <NumberField
            label={tr("Origine Y", "Origin Y")}
            value={actor.originY}
            onChange={(v) =>
              edit((a) => {
                a.originY = v;
              })
            }
          />
        </div>
        <button
          onClick={() => {
            const base = pose?.pieces[0]?.paletteId ?? project.palettes[0].id;
            const v = {
              id: uid(),
              name:
                tr("Variante", "Variant") + " " + (actor.variants.length + 1),
              palettes: { [base]: base },
            };
            edit((a) => a.variants.push(v));
            setVariant(v.id);
          }}
        >
          ＋ {tr("Variante par palette", "Palette variant")}
        </button>
        {variant && (
          <>
            <button
              onClick={() =>
                edit((a) => {
                  const cp = clone(variant);
                  cp.id = uid();
                  cp.name += tr(" copie", " copy");
                  a.variants.push(cp);
                  setVariant(cp.id);
                })
              }
            >
              {tr("Dupliquer la variante", "Duplicate variant")}
            </button>
            <Field label={tr("Nom de la variante", "Variant name")}>
              <input
                value={variant.name}
                onChange={(e) =>
                  edit((a) => {
                    a.variants.find((v) => v.id === variant.id)!.name =
                      e.target.value;
                  })
                }
              />
            </Field>
            {[
              ...new Set(
                actor.poses.flatMap((f) => f.pieces.map((c) => c.paletteId)),
              ),
            ].map((base) => (
              <Select
                key={base}
                label={
                  project.palettes.find((p) => p.id === base)?.name ?? base
                }
                value={variant.palettes[base] ?? base}
                options={project.palettes
                  .filter((p) => p.colors.length === 16)
                  .map((p) => ({ value: p.id, label: p.name }))}
                onChange={(v) =>
                  edit((a) => {
                    a.variants.find((v) => v.id === variant.id)!.palettes[
                      base
                    ] = v;
                  })
                }
              />
            ))}
            <button
              disabled={project.scenes.some((s) =>
                s.instances.some(
                  (i) => i.actorId === actor.id && i.variantId === variant.id,
                ),
              )}
              title={tr(
                "Les variantes utilisées dans une scène doivent d’abord être remplacées.",
                "Replace variants used in scenes before deleting them.",
              )}
              onClick={() => {
                edit((a) => {
                  a.variants = a.variants.filter((v) => v.id !== variant.id);
                });
                setVariant("");
              }}
            >
              {tr("Supprimer la variante", "Delete variant")}
            </button>
          </>
        )}
        <h3>
          {tr("Pièces", "Pieces")} ({pose?.pieces.length ?? 0})
        </h3>
        <Select
          label={tr("Accrochage", "Snapping")}
          value={snap}
          options={[1, 2, 4, 8, 16].map((n) => ({
            value: n,
            label: n + " px",
          }))}
          onChange={(v) => setSnap(+v)}
        />
        <button onClick={addPiece}>
          ＋ {tr("Ajouter une pièce", "Add piece")}
        </button>
        <Select
          label={tr("Dessin à découper", "Drawing to slice")}
          value={sliceSheet}
          options={project.sheets
            .filter((s) => s.bpp === 4)
            .map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSliceSheet}
        />
        <Select
          label={tr("Découpage", "Slicing")}
          value={sliceSize}
          options={[8, 16, 32, 64]
            .filter((n) => {
              const s = project.sheets.find((s) => s.id === sliceSheet);
              return s && s.width % n === 0 && s.height % n === 0;
            })
            .map((size) => {
              const s = project.sheets.find((s) => s.id === sliceSheet)!;
              let count = 0;
              for (let y = 0; y < s.height; y += size)
                for (let x = 0; x < s.width; x += size) {
                  let visible = false;
                  for (let yy = 0; yy < size; yy++)
                    for (let xx = 0; xx < size; xx++)
                      if (pixel(s, x + xx, y + yy)) visible = true;
                  if (visible) count++;
                }
              return {
                value: size,
                label: `${size} × ${size} · ${count} OBJ · ${(count * size * size) / 2} ${tr("octets", "bytes")}`,
              };
            })}
          onChange={(v) => setSliceSize(+v)}
        />
        <button
          disabled={!sliceSheet}
          onClick={() => {
            const s = project.sheets.find((s) => s.id === sliceSheet);
            if (!s) return;
            editPose((f) => {
              f.pieces = [];
              const size =
                s.width % sliceSize === 0 && s.height % sliceSize === 0
                  ? sliceSize
                  : 8;
              for (let y = 0; y < s.height; y += size)
                for (let x = 0; x < s.width; x += size) {
                  let visible = false;
                  for (let yy = 0; yy < size; yy++)
                    for (let xx = 0; xx < size; xx++)
                      if (pixel(s, x + xx, y + yy)) visible = true;
                  if (visible)
                    f.pieces.push({
                      id: uid(),
                      sheetId: s.id,
                      sx: x,
                      sy: y,
                      size,
                      x,
                      y,
                      paletteId: s.paletteId,
                      flipX: false,
                      flipY: false,
                      priority: 2,
                      group: "",
                    });
                }
            });
          }}
        >
          {tr("Appliquer le découpage à la pose", "Apply slicing to pose")}
        </button>
        {piece && (
          <>
            <Select
              label={tr("Dessin source", "Source graphics")}
              value={piece.sheetId}
              options={project.sheets
                .filter((s) => s.bpp === 4)
                .map((s) => ({ value: s.id, label: s.name }))}
              onChange={(v) =>
                editPiece((c) => {
                  c.sheetId = v;
                  c.sx = 0;
                  c.sy = 0;
                  c.size = 8;
                })
              }
            />
            <Select
              label={tr("Taille", "Size")}
              value={piece.size}
              options={[8, 16, 32, 64]
                .filter((n) => {
                  const s = project.sheets.find((s) => s.id === piece.sheetId)!;
                  return n <= s.width - piece.sx && n <= s.height - piece.sy;
                })
                .map((n) => ({ value: n, label: `${n} × ${n}` }))}
              onChange={(v) =>
                editPiece((c) => {
                  c.size = +v;
                })
              }
            />
            <div className="number-row">
              <NumberField
                label="X"
                value={piece.x}
                onChange={(v) =>
                  editPiece((c) => {
                    c.x = v;
                  })
                }
              />
              <NumberField
                label="Y"
                value={piece.y}
                onChange={(v) =>
                  editPiece((c) => {
                    c.y = v;
                  })
                }
              />
            </div>
            <div className="number-row">
              <NumberField
                label={tr("Source X", "Source X")}
                value={piece.sx}
                min={0}
                max={
                  project.sheets.find((s) => s.id === piece.sheetId)!.width -
                  piece.size
                }
                step={8}
                onChange={(v) =>
                  editPiece((c) => {
                    c.sx = Math.floor(v / 8) * 8;
                  })
                }
              />
              <NumberField
                label={tr("Source Y", "Source Y")}
                value={piece.sy}
                min={0}
                max={
                  project.sheets.find((s) => s.id === piece.sheetId)!.height -
                  piece.size
                }
                step={8}
                onChange={(v) =>
                  editPiece((c) => {
                    c.sy = Math.floor(v / 8) * 8;
                  })
                }
              />
            </div>
            <Select
              label={tr("Palette", "Palette")}
              value={piece.paletteId}
              options={project.palettes
                .filter((p) => p.colors.length === 16)
                .map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) =>
                editPiece((c) => {
                  c.paletteId = v;
                })
              }
            />
            <NumberField
              label={tr("Priorité", "Priority")}
              value={piece.priority}
              min={0}
              max={3}
              onChange={(v) =>
                editPiece((c) => {
                  c.priority = v;
                })
              }
            />
            <Check
              label={tr("Miroir horizontal", "Flip horizontally")}
              value={piece.flipX}
              onChange={(v) =>
                editPiece((c) => {
                  c.flipX = v;
                })
              }
            />
            <Check
              label={tr("Miroir vertical", "Flip vertically")}
              value={piece.flipY}
              onChange={(v) =>
                editPiece((c) => {
                  c.flipY = v;
                })
              }
            />
            <Field label={tr("Groupe", "Group")}>
              <input
                value={piece.group}
                onChange={(e) =>
                  editPiece((c) => {
                    c.group = e.target.value;
                  })
                }
              />
            </Field>
            <button
              className="danger"
              onClick={() =>
                edit((a) => {
                  a.poses.find((f) => f.id === pose!.id)!.pieces =
                    pose!.pieces.filter((c) => c.id !== piece.id);
                })
              }
            >
              {tr("Supprimer la pièce", "Delete piece")}
            </button>
          </>
        )}
        {selectedIds.length > 0 && (
          <details open>
            <summary>
              {tr("Transformer la sélection", "Transform selection")}
            </summary>
            <button
              onClick={() =>
                editPose((p) => {
                  const copies = p.pieces
                    .filter((c) => selectedIds.includes(c.id))
                    .map((c) => ({ ...clone(c), id: uid(), x: c.x + 8 }));
                  p.pieces.push(...copies);
                  setSelectedPieces(copies.map((c) => c.id));
                  setPiece(copies.at(-1)?.id ?? "");
                })
              }
            >
              {tr("Dupliquer les pièces", "Duplicate pieces")}
            </button>
            <button
              onClick={() => {
                editPose((p) => {
                  p.pieces = p.pieces.filter(
                    (c) => !selectedIds.includes(c.id),
                  );
                });
                setSelectedPieces([]);
                setPiece("");
              }}
            >
              {tr("Supprimer les pièces", "Delete pieces")}
            </button>
            {piece && (
              <Select
                label={tr(
                  "Aligner sur la pièce active",
                  "Align to active piece",
                )}
                value=""
                options={[
                  { value: "", label: tr("Choisir…", "Choose…") },
                  ...[
                    tr("Gauche", "Left"),
                    tr("Centre horizontal", "Horizontal centre"),
                    tr("Droite", "Right"),
                    tr("Haut", "Top"),
                    tr("Centre vertical", "Vertical centre"),
                    tr("Bas", "Bottom"),
                  ].map((label, value) => ({ label, value: String(value) })),
                ]}
                onChange={(v) => {
                  if (v === "") return;
                  const index = Number(v),
                    axis = index < 3 ? "x" : "y",
                    factor = (index % 3) / 2;
                  editPose((p) => {
                    for (const c of p.pieces)
                      if (selectedIds.includes(c.id))
                        c[axis] = Math.round(
                          piece[axis] + piece.size * factor - c.size * factor,
                        );
                  });
                }}
              />
            )}
            <button
              onClick={() =>
                editPose((p) => {
                  for (const c of p.pieces)
                    if (selectedIds.includes(c.id)) c.flipX = !c.flipX;
                })
              }
            >
              {tr(
                "Inverser les miroirs horizontaux",
                "Toggle horizontal flips",
              )}
            </button>
            <button
              onClick={() =>
                editPose((p) => {
                  for (const c of p.pieces)
                    if (selectedIds.includes(c.id)) c.flipY = !c.flipY;
                })
              }
            >
              {tr("Inverser les miroirs verticaux", "Toggle vertical flips")}
            </button>
            <NumberField
              label={tr("Priorité de la sélection", "Selection priority")}
              min={0}
              max={3}
              value={piece?.priority ?? 0}
              onChange={(v) =>
                editPose((p) => {
                  for (const c of p.pieces)
                    if (selectedIds.includes(c.id)) c.priority = v;
                })
              }
            />
            {piece?.group && (
              <>
                <p>
                  {tr(
                    "Copier le placement du groupe ",
                    "Copy placement of group ",
                  )}
                  {piece.group}
                </p>
                {actor.poses
                  .filter((p) => p.id !== pose!.id)
                  .map((p) => (
                    <Check
                      key={p.id}
                      label={p.name}
                      value={targetPoses.includes(p.id)}
                      onChange={(v) =>
                        setTargetPoses((ids) =>
                          v ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                        )
                      }
                    />
                  ))}
                <button
                  disabled={!targetPoses.length}
                  onClick={() =>
                    edit((a) =>
                      copyGroupPlacement(a, pose!.id, piece.group, targetPoses),
                    )
                  }
                >
                  {tr("Copier le placement", "Copy placement")}
                </button>
              </>
            )}
          </details>
        )}
        {selectedIds.length > 0 && (
          <>
            <p>
              {selectedIds.length}{" "}
              {tr(
                "pièces sélectionnées (Maj+clic)",
                "selected pieces (Shift+click)",
              )}
            </p>
            <Select
              label={tr(
                "Palette des pièces sélectionnées",
                "Selected pieces palette",
              )}
              value=""
              options={[
                { value: "", label: tr("Choisir…", "Choose…") },
                ...project.palettes
                  .filter((p) => p.colors.length >= 16)
                  .map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(id) => {
                if (id)
                  editPose((p) => {
                    for (const c of p.pieces)
                      if (selectedIds.includes(c.id)) c.paletteId = id;
                  });
              }}
            />
          </>
        )}
        <h3>{tr("Animation", "Animation")}</h3>
        {animation && (
          <>
            <Field label={tr("Nom de l’animation", "Animation name")}>
              <input
                value={animation.name}
                onChange={(e) =>
                  editAnimation((a) => {
                    a.name = e.target.value;
                  })
                }
              />
            </Field>
            <Check
              label={tr("Boucle", "Loop")}
              value={animation.loop}
              onChange={(v) =>
                editAnimation((a) => {
                  a.loop = v;
                })
              }
            />
            <Check
              label={tr("Aller-retour", "Ping-pong")}
              value={animation.pingPong}
              onChange={(v) =>
                editAnimation((a) => {
                  a.pingPong = v;
                })
              }
            />
            <button
              disabled={
                actor.animations.length < 2 ||
                project.scenes.some((s) =>
                  s.instances.some(
                    (i) =>
                      i.actorId === actor.id && i.animationId === animation.id,
                  ),
                )
              }
              title={tr(
                "Remplacer les animations utilisées dans les scènes avant de les supprimer.",
                "Replace animations used in scenes before deleting them.",
              )}
              onClick={() => {
                edit((a) => {
                  a.animations = a.animations.filter(
                    (v) => v.id !== animation.id,
                  );
                });
                setAnim(0);
              }}
            >
              {tr("Supprimer l’animation", "Delete animation")}
            </button>
          </>
        )}
        <button
          onClick={() => {
            edit((a) => {
              a.animations.push({
                id: uid(),
                name:
                  tr("Animation", "Animation") +
                  " " +
                  (a.animations.length + 1),
                loop: true,
                pingPong: false,
                frames: [{ poseId: a.poses[0].id, ticks: 8, event: "" }],
              });
            });
            setAnim(actor.animations.length);
          }}
        >
          ＋ {tr("Animation", "Animation")}
        </button>
        <details>
          <summary>
            {tr("Collisions et attaches", "Collisions and anchors")}
          </summary>
          {pose?.boxes.map((b, n) => (
            <div key={n}>
              <Field label={tr("Nom", "Name")}>
                <input
                  value={b.name}
                  onChange={(e) =>
                    editPose((p) => {
                      p.boxes[n].name = e.target.value;
                    })
                  }
                />
              </Field>
              {(["x", "y", "width", "height"] as const).map((k) => (
                <NumberField
                  key={k}
                  label={k}
                  value={b[k]}
                  min={k === "width" || k === "height" ? 1 : -32768}
                  onChange={(v) =>
                    editPose((p) => {
                      p.boxes[n][k] = v;
                    })
                  }
                />
              ))}
              <button
                onClick={() =>
                  editPose((p) => {
                    p.boxes.splice(n, 1);
                  })
                }
              >
                {tr("Supprimer la collision", "Delete hitbox")}
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              editPose((p) => {
                p.boxes.push({
                  name: "hitbox",
                  x: 0,
                  y: 0,
                  width: 16,
                  height: 16,
                });
              })
            }
          >
            ＋ {tr("Collision", "Hitbox")}
          </button>
          {pose?.anchors.map((b, n) => (
            <div key={n}>
              <Field label={tr("Nom", "Name")}>
                <input
                  value={b.name}
                  onChange={(e) =>
                    editPose((p) => {
                      p.anchors[n].name = e.target.value;
                    })
                  }
                />
              </Field>
              {(["x", "y"] as const).map((k) => (
                <NumberField
                  key={k}
                  label={k}
                  value={b[k]}
                  onChange={(v) =>
                    editPose((p) => {
                      p.anchors[n][k] = v;
                    })
                  }
                />
              ))}
              <button
                onClick={() =>
                  editPose((p) => {
                    p.anchors.splice(n, 1);
                  })
                }
              >
                {tr("Supprimer l’attache", "Delete anchor")}
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              editPose((p) => {
                p.anchors.push({ name: "attach", x: 0, y: 0 });
              })
            }
          >
            ＋ {tr("Attache", "Anchor")}
          </button>
        </details>
      </aside>
    </>
  );
}
