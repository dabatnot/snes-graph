import { useState } from "react";
import { clone, type Actor, type Animation } from "../core/model";
import { moveFrames } from "../core/animation-edit";
import { Check, NumberField, Select } from "./controls";
import { tr } from "../i18n";
export function AnimationTimeline({
  actor,
  animation,
  fps,
  edit,
  onSeek,
  onRange,
  tick,
  playing,
}: {
  actor: Actor;
  animation: Animation;
  fps: number;
  edit: (fn: (a: Animation) => void) => void;
  onSeek: (poseId: string) => void;
  onRange: (range: [number, number] | null) => void;
  tick: number;
  playing: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [duration, setDuration] = useState(8),
    [range, setRange] = useState(false),
    [from, setFrom] = useState(0),
    [to, setTo] = useState(animation.frames.length - 1),
    [cursor, setCursor] = useState(0);
  const ids = selected.filter((i) => i < animation.frames.length);
  const total = animation.frames.reduce((n, f) => n + f.ticks, 0);
  const first = Math.min(from, animation.frames.length - 1);
  const last = Math.max(first, Math.min(to, animation.frames.length - 1));
  const rangeStart = animation.frames
    .slice(0, first)
    .reduce((n, f) => n + f.ticks, 0);
  const rangeDuration = animation.frames
    .slice(first, last + 1)
    .reduce((n, f) => n + f.ticks, 0);
  const playhead = playing
    ? range
      ? rangeStart + (tick % rangeDuration)
      : animation.loop
        ? tick % total
        : Math.min(tick, total - 1)
    : Math.min(cursor, total - 1);
  const seek = (t: number) => {
    setCursor(t);
    let remaining = t;
    for (const f of animation.frames) {
      if (remaining < f.ticks) {
        onSeek(f.poseId);
        break;
      }
      remaining -= f.ticks;
    }
  };
  return (
    <>
      <div className="button-row">
        <button
          disabled={!ids.length}
          onClick={() => {
            edit((a) => {
              const last = Math.max(...ids);
              a.frames.splice(
                last + 1,
                0,
                ...ids
                  .slice()
                  .sort((a, b) => a - b)
                  .map((i) => clone(a.frames[i])),
              );
            });
            setSelected([]);
            onRange(null);
            setRange(false);
          }}
        >
          {tr("Dupliquer les images", "Duplicate frames")}
        </button>
        <button
          disabled={!ids.length || ids.length === animation.frames.length}
          onClick={() => {
            edit((a) => {
              a.frames = a.frames.filter((_, i) => !ids.includes(i));
            });
            setSelected([]);
            onRange(null);
            setRange(false);
          }}
        >
          {tr("Supprimer les images", "Delete frames")}
        </button>
        <NumberField
          label={tr("Durée commune (images)", "Shared duration (frames)")}
          min={1}
          max={65535}
          value={duration}
          onChange={setDuration}
        />
        <button
          disabled={!ids.length}
          onClick={() =>
            edit((a) => {
              ids.forEach((i) => (a.frames[i].ticks = duration));
            })
          }
        >
          {tr("Appliquer la durée", "Apply duration")} (
          {((1000 * duration) / fps).toFixed(0)} ms)
        </button>
      </div>
      <label className="field">
        <span>
          {tr("Curseur de lecture", "Playhead")} · {playhead} / {total}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={playhead}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <div className="button-row">
        <Check
          label={tr("Boucler une plage", "Loop a range")}
          value={range}
          onChange={(v) => {
            setRange(v);
            onRange(v ? [first, last] : null);
          }}
        />
        <NumberField
          label={tr("Première image", "First frame")}
          min={1}
          max={animation.frames.length}
          value={first + 1}
          onChange={(v) => {
            setFrom(v - 1);
            if (range)
              onRange([
                v - 1,
                Math.max(v - 1, Math.min(to, animation.frames.length - 1)),
              ]);
          }}
        />
        <NumberField
          label={tr("Dernière image", "Last frame")}
          min={first + 1}
          max={animation.frames.length}
          value={last + 1}
          onChange={(v) => {
            setTo(v - 1);
            if (range) onRange([first, v - 1]);
          }}
        />
      </div>
      <div className="frame-sequence">
        {animation.frames.map((f, n) => (
          <div
            key={n}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(n));
              if (!ids.includes(n)) setSelected([n]);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const source = Number(e.dataTransfer.getData("text/plain"));
              if (
                !Number.isInteger(source) ||
                source < 0 ||
                source >= animation.frames.length
              )
                return;
              edit((a) =>
                moveFrames(a, ids.includes(source) ? ids : [source], n),
              );
              setSelected([]);
              onRange(null);
              setRange(false);
            }}
            style={{
              border: ids.includes(n) ? "1px solid #8daaff" : undefined,
            }}
          >
            <Check
              label={`${tr("Image", "Frame")} ${n + 1}`}
              value={ids.includes(n)}
              onChange={(checked) =>
                setSelected((s) =>
                  checked ? [...s, n] : s.filter((i) => i !== n),
                )
              }
            />
            <button onClick={() => onSeek(f.poseId)}>
              {n + 1} · {f.event || "—"}
            </button>
            <Select
              label={tr("Pose", "Pose")}
              value={f.poseId}
              options={actor.poses.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) =>
                edit((a) => {
                  a.frames[n].poseId = v;
                })
              }
            />
            <NumberField
              label={tr("Images", "Frames")}
              min={1}
              max={65535}
              value={f.ticks}
              onChange={(v) =>
                edit((a) => {
                  a.frames[n].ticks = v;
                })
              }
            />
            <input
              aria-label={`${tr("Événement", "Event")} ${n + 1}`}
              placeholder={tr("Événement", "Event")}
              value={f.event}
              onChange={(e) =>
                edit((a) => {
                  a.frames[n].event = e.target.value;
                })
              }
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          edit((a) => {
            a.frames.push({ poseId: actor.poses[0].id, ticks: 8, event: "" });
          });
          setTo(animation.frames.length);
        }}
      >
        + {tr("Image", "Frame")}
      </button>
    </>
  );
}
