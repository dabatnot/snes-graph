import { useEffect, useRef, useState } from "react";
import { type Project, type Scene } from "../core/model";
import { objectLoad } from "../core/snes";
import { sceneMemory } from "../core/scene-analysis";
import { NumberField } from "./controls";
import { tr } from "../i18n";
export function SceneAnalysis({
  project,
  scene,
  tick,
  onSeek,
  onLocate,
  onResource,
}: {
  project: Project;
  scene: Scene;
  tick: number;
  onSeek: (tick: number) => void;
  onLocate: (line: number, instances: string[]) => void;
  onResource: (id: string) => void;
}) {
  const [memory, setMemory] = useState<ReturnType<typeof sceneMemory>>(),
    [memoryTick, setMemoryTick] = useState(0),
    [error, setError] = useState(""),
    [start, setStart] = useState(0),
    [length, setLength] = useState(120),
    [progress, setProgress] = useState<number | null>(null),
    [results, setResults] = useState<
      {
        tick: number;
        objects: number;
        row: number;
        slivers: number;
        bytes: number;
        error: string;
      }[]
    >([]);
  const run = useRef(0);
  useEffect(() => {
    run.current++;
    setMemory(undefined);
    setResults([]);
    setProgress(null);
    setError("");
    return () => {
      run.current++;
    };
  }, [project, scene.id]);
  const load = objectLoad(project, scene, tick);
  const analyse = async () => {
    const token = ++run.current,
      rows: typeof results = [];
    setResults([]);
    setProgress(0);
    for (let n = 0; n < length; n++) {
      if (run.current !== token) return;
      const time = start + n,
        l = objectLoad(project, scene, time);
      let bytes = 0,
        issue = "";
      try {
        const m = sceneMemory(project, scene, time);
        bytes = Math.max(0, ...m.allocations.map((a) => a.address + a.bytes));
      } catch (e) {
        issue = String(e);
      }
      rows.push({
        tick: time,
        objects: l.total,
        row: Math.max(0, ...l.rows.map((r) => r.sprites)),
        slivers: Math.max(0, ...l.rows.map((r) => r.slivers)),
        bytes,
        error: issue,
      });
      setProgress(n + 1);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (run.current === token) {
      setResults(rows);
      setProgress(null);
    }
  };
  return (
    <details>
      <summary>
        {tr("Mémoire et analyse temporelle", "Memory and time analysis")}
      </summary>
      <p>
        {tr(
          "Allocation sans déduplication, calculée par le compilateur d’export. Les charges OBJ restent des diagnostics, pas une émulation de l’ordre de disparition.",
          "Allocation without deduplication, calculated by the export compiler. OBJ loads are diagnostics, not emulation of sprite drop order.",
        )}
      </p>
      <button
        onClick={() => {
          try {
            setMemory(sceneMemory(project, scene, tick));
            setMemoryTick(tick);
            setError("");
          } catch (e) {
            setMemory(undefined);
            setError(String(e));
          }
        }}
      >
        {tr(
          "Calculer la mémoire à cette image",
          "Calculate memory at this frame",
        )}
      </button>
      {error && <p className="error">{error}</p>}
      {memory && (
        <>
          <h4>
            VRAM · {tr("Image", "Frame")} {memoryTick}
          </h4>
          <div style={{ position: "relative", height: 24, background: "#111" }}>
            {memory.allocations.map((a, i) => (
              <span
                key={i}
                title={`${a.name}: ${a.address} + ${a.bytes}`}
                style={{
                  position: "absolute",
                  left: `${(a.address / 65536) * 100}%`,
                  width: `${(a.bytes / 65536) * 100}%`,
                  height: 24,
                  background: `hsl(${i * 67} 55% 50%)`,
                }}
              />
            ))}
          </div>
          <table>
            <tbody>
              {memory.allocations.map((a, i) => (
                <tr key={i}>
                  <td>
                    {a.resource ? (
                      <button onClick={() => onResource(a.resource!)}>
                        {a.name}
                      </button>
                    ) : (
                      a.name
                    )}
                  </td>
                  <td>
                    ${a.address.toString(16)} – $
                    {(a.address + a.bytes - 1).toString(16)}
                  </td>
                  <td>
                    {a.bytes} {tr("octets", "bytes")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>CGRAM</h4>
          <div style={{ position: "relative", height: 24, background: "#111" }}>
            {memory.palettes.map((a, i) => {
              const pal = project.palettes.find((p) => p.id === a.id)!;
              return (
                <span
                  key={i}
                  title={pal.name}
                  style={{
                    position: "absolute",
                    left: `${(a.address / 256) * 100}%`,
                    width: `${(pal.colors.length / 256) * 100}%`,
                    height: 24,
                    background: `hsl(${i * 67} 55% 50%)`,
                  }}
                />
              );
            })}
          </div>
          <table>
            <tbody>
              {memory.palettes.map((a, i) => (
                <tr key={i}>
                  <td>
                    <button onClick={() => onResource(a.id)}>
                      {project.palettes.find((p) => p.id === a.id)?.name}
                    </button>
                  </td>
                  <td>{a.layer === 4 ? "OBJ" : `BG${a.layer + 1}`}</td>
                  <td>${(a.address * 2).toString(16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {load.rows.flatMap((r, line) =>
        r.sprites > 32 || r.slivers > 34
          ? [
              <button key={line} onClick={() => onLocate(line, r.instances)}>
                {tr("Ligne", "Line")} {line}: {r.sprites} OBJ / {r.slivers}{" "}
                {tr("portions", "slivers")}
              </button>,
            ]
          : [],
      )}
      <div className="number-row">
        <NumberField
          label={tr("Image de départ", "Start frame")}
          min={0}
          max={65535}
          value={start}
          onChange={setStart}
        />
        <NumberField
          label={tr("Nombre d’images", "Frame count")}
          min={1}
          max={600}
          value={length}
          onChange={setLength}
        />
      </div>
      {progress === null ? (
        <button onClick={() => void analyse()}>
          {tr("Analyser la plage", "Analyze range")}
        </button>
      ) : (
        <>
          <progress value={progress} max={length} />
          <button
            onClick={() => {
              run.current++;
              setProgress(null);
            }}
          >
            {tr("Annuler l’analyse", "Cancel analysis")}
          </button>
        </>
      )}
      {results.length > 0 && (
        <>
          <p>
            {tr("Maxima :", "Peaks:")}{" "}
            {Math.max(...results.map((r) => r.objects))} OBJ ·{" "}
            {Math.max(...results.map((r) => r.row))} OBJ/{tr("ligne", "line")} ·{" "}
            {Math.max(...results.map((r) => r.slivers))}{" "}
            {tr("portions/ligne", "slivers/line")}
          </p>
          <svg
            viewBox={`0 0 ${results.length} 100`}
            role="img"
            aria-label={tr("Charge OBJ par image", "OBJ load per frame")}
            style={{ width: "100%", height: 100 }}
          >
            <polyline
              fill="none"
              stroke="#ffc857"
              strokeWidth="1"
              points={results
                .map(
                  (r, i) => `${i},${100 - Math.min(100, (r.row / 32) * 100)}`,
                )
                .join(" ")}
            />
          </svg>
          <table>
            <thead>
              <tr>
                <th>{tr("Image", "Frame")}</th>
                <th>OBJ</th>
                <th>OBJ/{tr("ligne", "line")}</th>
                <th>{tr("Portions", "Slivers")}</th>
                <th>VRAM</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.tick}>
                  <td>
                    <button onClick={() => onSeek(r.tick)}>{r.tick}</button>
                  </td>
                  <td>{r.objects}</td>
                  <td>{r.row}</td>
                  <td>{r.slivers}</td>
                  <td>{r.error || r.bytes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </details>
  );
}
