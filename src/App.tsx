import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  newProject,
  footballProject,
  clone,
  makePalette,
  makeSheet,
  makeActor,
  makeMap,
  makeScene,
  uid,
  uses,
  type Project,
  type Bpp,
} from "./core/model";
import { loadProject, saveProject } from "./core/archive";
import {
  duplicateResource,
  removeResource,
  replaceReferences,
  type ResourceKind,
} from "./core/resources";
import { importPng, exportPng } from "./core/import";
import { importAseprite } from "./core/aseprite";
import { renderSheet } from "./core/render";
import {
  chooseFile,
  saveBytes,
  saveRecovery,
  loadRecovery,
  initialProject,
} from "./platform";
import i18n, { tr } from "./i18n";
import { Drawing } from "./ui/Drawing";
import { Palettes } from "./ui/Palettes";
import { Sprites } from "./ui/Sprites";
import { Maps } from "./ui/Maps";
import { Scenes } from "./ui/Scenes";
import { Exports } from "./ui/Exports";
import {
  Empty,
  Field,
  NumberField,
  Select,
  Preview,
  Check,
} from "./ui/controls";
type Tab = "sheets" | "palettes" | "actors" | "maps" | "scenes" | "exports";
export default function App() {
  useTranslation();
  const [project, setProject] = useState(newProject),
    [tab, setTab] = useState<Tab>("sheets"),
    [selected, setSelected] = useState(""),
    [paletteId, setPalette] = useState(""),
    [path, setPath] = useState<string>(),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<
      | null
      | "create"
      | "help"
      | "import"
      | "replace"
      | "close"
      | "usages"
      | "fps"
    >(null),
    [name, setName] = useState(""),
    [width, setWidth] = useState(32),
    [height, setHeight] = useState(32),
    [bpp, setBpp] = useState<Bpp>(4),
    [newSize, setNewSize] = useState(16),
    [pending, setPending] = useState<{
      project: Project;
      path?: string;
      recovered?: boolean;
    } | null>(null),
    [recovery, setRecovery] = useState<Project | null>(null),
    [imported, setImported] = useState<{
      name: string;
      bytes: Uint8Array;
    } | null>(null),
    [importPalette, setImportPalette] = useState(""),
    [dither, setDither] = useState(false);
  const [replacement, setReplacement] = useState(""),
    [reimportId, setReimportId] = useState("");
  const [returnActor, setReturnActor] = useState("");
  const [targetFps, setTargetFps] = useState<50 | 60>(60);
  const [originalImage, setOriginalImage] = useState("");
  useEffect(() => {
    if (!imported || !/\.png$/i.test(imported.name)) {
      setOriginalImage("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(imported.bytes)], { type: "image/png" }),
    );
    setOriginalImage(url);
    return () => URL.revokeObjectURL(url);
  }, [imported]);
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    pRef = useRef(project),
    dirtyRef = useRef(dirty),
    savedId = useRef(project);
  pRef.current = project;
  dirtyRef.current = dirty;
  const report = useCallback((s: string) => setNotice(s), []);
  const change = useCallback(
    (f: (p: Project) => void) => {
      try {
        const before = pRef.current,
          next = clone(before);
        f(next);
        past.current.push(before);
        if (past.current.length > 50) past.current.shift();
        const bytes = (p: Project) =>
          p.sheets.reduce(
            (n, s) =>
              n +
              s.pixels.length +
              (s.layers ?? []).reduce((a, l) => a + l.pixels.length, 0),
            0,
          ) + p.maps.reduce((n, m) => n + m.cells.length * 64, 0);
        let retained = past.current.reduce((n, p) => n + bytes(p), 0);
        while (past.current.length > 1 && retained > 128 * 1024 * 1024)
          retained -= bytes(past.current.shift()!);
        future.current = [];
        pRef.current = next;
        dirtyRef.current = true;
        setProject(next);
        setDirty(true);
        return true;
      } catch (e) {
        report(String(e));
        return false;
      }
    },
    [report],
  );
  const replace = (p: Project, destination?: string, recovered = false) => {
    setProject(p);
    pRef.current = p;
    setSelected("");
    setPalette("");
    setDirty(recovered);
    dirtyRef.current = recovered;
    savedId.current = p;
    past.current = [];
    future.current = [];
    setPath(destination);
    setPending(null);
    setModal(null);
  };
  const requestReplace = (
    p: Project,
    destination?: string,
    recovered = false,
  ) => {
    if (dirtyRef.current) {
      setPending({ project: p, path: destination, recovered });
      setModal("replace");
    } else replace(p, destination, recovered);
  };
  const undo = () => {
    const previous = past.current.pop();
    if (previous) {
      future.current.push(pRef.current);
      pRef.current = previous;
      setProject(previous);
      setDirty(previous !== savedId.current);
    }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next) {
      past.current.push(pRef.current);
      pRef.current = next;
      setProject(next);
      setDirty(next !== savedId.current);
    }
  };
  const save = async (as = false) => {
    try {
      const current = pRef.current;
      const dest = await saveBytes(
        saveProject(current),
        current.name + ".snesgraph",
        as ? undefined : path,
      );
      if (dest) {
        setPath(dest);
        savedId.current = current;
        if (pRef.current === current) {
          setDirty(false);
          dirtyRef.current = false;
        }
        report(tr("Projet enregistré", "Project saved"));
      }
    } catch (e) {
      report(String(e));
    }
  };
  const openProject = async () => {
    try {
      const f = await chooseFile(["snesgraph"]);
      if (f) {
        const p = loadProject(f.bytes);
        requestReplace(p, f.path);
      }
    } catch (e) {
      report(String(e));
    }
  };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (dirtyRef.current) {
          event.preventDefault();
          setModal("close");
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unsubscribe = fn;
      });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    loadRecovery()
      .then((bytes) => {
        if (bytes) setRecovery(loadProject(bytes));
      })
      .catch((e) =>
        report(
          tr("Récupération indisponible : ", "Recovery unavailable: ") +
            String(e),
        ),
      );
    initialProject()
      .then((file) => {
        if (file) {
          replace(loadProject(Uint8Array.from(file[1])), file[0]);
          setRecovery(null);
        }
      })
      .catch((e) => report(String(e)));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(
      () =>
        Promise.resolve()
          .then(() => saveRecovery(saveProject(project)))
          .catch((e) =>
            report(
              tr(
                "La récupération automatique a échoué : ",
                "Recovery save failed: ",
              ) + String(e),
            ),
          ),
      1500,
    );
    return () => clearTimeout(timer);
  }, [project, dirty, report]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault();
          void save(e.shiftKey);
        }
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        if (e.key === "y") {
          e.preventDefault();
          redo();
        }
        if (e.key === "o") {
          e.preventDefault();
          void openProject();
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  const items = tab === "exports" ? [] : project[tab];
  const resource = items.find((s) => s.id === selected) ?? items[0];
  const sheet = project.sheets.find((s) => s.id === resource?.id),
    palette = project.palettes.find((s) => s.id === resource?.id),
    actor = project.actors.find((s) => s.id === resource?.id),
    map = project.maps.find((s) => s.id === resource?.id),
    scene = project.scenes.find((s) => s.id === resource?.id);
  const names: Record<Tab, string> = {
    sheets: tr("Dessins", "Graphics"),
    palettes: tr("Palettes", "Palettes"),
    actors: tr("Sprites", "Sprites"),
    maps: tr("Cartes", "Maps"),
    scenes: tr("Scènes", "Scenes"),
    exports: tr("Exporter", "Export"),
  };
  const create = () => {
    let id = "";
    change((p) => {
      if (tab === "palettes") {
        const a = makePalette(name || "Palette", newSize);
        p.palettes.push(a);
        id = a.id;
      }
      if (tab === "sheets") {
        let pal = p.palettes.find((p) => p.colors.length === 1 << bpp);
        if (!pal) {
          pal = makePalette("Palette", 1 << bpp);
          p.palettes.push(pal);
        }
        const a = makeSheet(
          pal.id,
          Math.ceil(width / 8) * 8,
          Math.ceil(height / 8) * 8,
          bpp,
          name || "Tiles",
        );
        p.sheets.push(a);
        id = a.id;
      }
      if (tab === "actors") {
        const a = makeActor(name || "Sprite");
        p.actors.push(a);
        id = a.id;
      }
      if (tab === "maps") {
        const a = makeMap(p.sheets[0], width, height);
        a.name = name || "Tilemap";
        p.maps.push(a);
        id = a.id;
      }
      if (tab === "scenes") {
        const a = makeScene();
        a.name = name || "Scene";
        p.scenes.push(a);
        id = a.id;
      }
    });
    setSelected(id);
    setModal(null);
  };
  let imp:
    | (ReturnType<typeof importPng> & { actor?: Project["actors"][number] })
    | undefined;
  let importError = "";
  if (imported && modal === "import") {
    try {
      imp = /\.(ase|aseprite)$/i.test(imported.name)
        ? importAseprite(
            imported.bytes,
            imported.name.replace(/\.[^.]+$/, ""),
            project.fps,
            project.palettes.find((p) => p.id === importPalette),
            dither,
          )
        : importPng(
            imported.bytes,
            imported.name.replace(/\.[^.]+$/, ""),
            project.palettes.find((p) => p.id === importPalette),
            dither,
          );
    } catch (e) {
      importError = String(e);
    }
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <i />
            <i />
            <i />
            <i />
          </span>
          SNES <strong>Graph</strong>
        </div>
        <div className="project-name">
          {project.name}
          {dirty ? " •" : ""}
        </div>
        <div className="top-actions">
          <button
            onClick={() => {
              setTab("sheets");
              requestReplace(newProject());
            }}
          >
            {tr("Nouveau", "New")}
          </button>
          <button onClick={openProject}>{tr("Ouvrir", "Open")}</button>
          <button className="primary" onClick={() => save()}>
            {tr("Enregistrer", "Save")}
          </button>
          <button
            title={tr("Enregistrer sous", "Save as")}
            onClick={() => save(true)}
          >
            ⋯
          </button>
          <span className="separator" />
          <button
            disabled={!past.current.length}
            aria-label={tr("Annuler", "Undo")}
            onClick={undo}
          >
            ↶
          </button>
          <button
            disabled={!future.current.length}
            aria-label={tr("Rétablir", "Redo")}
            onClick={redo}
          >
            ↷
          </button>
          <select
            aria-label="Language"
            value={i18n.language}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value);
              localStorage.setItem("snes-graph-language", e.target.value);
              document.documentElement.lang = e.target.value;
            }}
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
          <button onClick={() => setModal("help")}>?</button>
        </div>
      </header>
      <nav className="tabs" aria-label={tr("Ateliers", "Workspaces")}>
        {(Object.keys(names) as Tab[]).map((key, n) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setSelected("");
              setSearch("");
            }}
          >
            <span>{["▦", "◉", "♙", "▥", "▣", "↗"][n]}</span>
            {names[key]}
          </button>
        ))}
      </nav>
      {recovery && (
        <div className="recovery">
          <span>
            {tr(
              "Un projet récupérable est disponible : ",
              "A recoverable project is available: ",
            )}
            {recovery.name}
          </span>
          <button
            onClick={() => {
              requestReplace(recovery, undefined, true);
              setRecovery(null);
            }}
          >
            {tr("Récupérer", "Recover")}
          </button>
          <button onClick={() => setRecovery(null)}>
            {tr("Ignorer", "Dismiss")}
          </button>
        </div>
      )}
      <div className="layout">
        {tab !== "exports" && (
          <aside className="library">
            <div className="library-heading">
              <h3>{names[tab]}</h3>
              <button
                aria-label={
                  tab === "sheets"
                    ? tr("Créer un dessin", "Create drawing")
                    : tr("Créer une ressource", "Create resource")
                }
                title={
                  tab === "sheets"
                    ? tr("Créer un dessin", "Create drawing")
                    : tr("Créer une ressource", "Create resource")
                }
                onClick={() => {
                  setName("");
                  setWidth(32);
                  setHeight(tab === "sheets" ? 32 : 32);
                  setModal("create");
                }}
              >
                + {tr("Nouveau", "New")}
              </button>
            </div>
            <input
              className="search"
              aria-label={tr("Rechercher", "Search")}
              placeholder={tr("Rechercher…", "Search…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="resource-list">
              {items
                .filter((s) =>
                  s.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    className={resource?.id === s.id ? "selected" : ""}
                    onClick={() => setSelected(s.id)}
                  >
                    <span className="resource-icon">
                      {tab === "sheets" ? (
                        <Preview
                          image={renderSheet(
                            project,
                            s as (typeof project.sheets)[number],
                          )}
                          scale={Math.min(
                            24 / (s as (typeof project.sheets)[number]).width,
                            24 / (s as (typeof project.sheets)[number]).height,
                          )}
                        />
                      ) : ["palettes", "actors", "maps", "scenes"].includes(
                          tab,
                        ) ? (
                        { palettes: "◉", actors: "♙", maps: "▥", scenes: "▣" }[
                          tab
                        ]
                      ) : (
                        ""
                      )}
                    </span>
                    <span>{s.name}</span>
                  </button>
                ))}
            </div>
            {tab === "sheets" && (
              <div className="library-bottom">
                <button
                  onClick={async () => {
                    const f = await chooseFile(["png", "ase", "aseprite"]);
                    if (f) {
                      setReimportId("");
                      setImportPalette("");
                      setImported(f);
                      setModal("import");
                    }
                  }}
                >
                  {tr("Importer PNG / Aseprite", "Import PNG / Aseprite")}
                </button>
                {sheet && (
                  <button
                    onClick={async () => {
                      try {
                        await saveBytes(
                          exportPng(
                            renderSheet(
                              project,
                              sheet,
                              paletteId || sheet.paletteId,
                            ),
                          ),
                          sheet.name + ".png",
                        );
                      } catch (e) {
                        report(String(e));
                      }
                    }}
                  >
                    {tr("Exporter en PNG", "Export PNG")}
                  </button>
                )}
              </div>
            )}
            <button
              className="example-button"
              onClick={() => {
                setTab("sheets");
                requestReplace(footballProject());
              }}
            >
              {tr("Ouvrir l’exemple football", "Open football example")}
            </button>
            {resource && (
              <div className="library-bottom">
                {returnActor && tab === "sheets" && (
                  <button
                    onClick={() => {
                      setTab("actors");
                      setSelected(returnActor);
                      setReturnActor("");
                    }}
                  >
                    {tr("Revenir au personnage", "Back to character")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setReplacement("");
                    setModal("usages");
                  }}
                >
                  {tr("Usages et remplacement", "Uses and replacement")}
                </button>
                <button
                  onClick={() =>
                    change((p) => {
                      setSelected(
                        duplicateResource(p, tab as ResourceKind, resource.id),
                      );
                    })
                  }
                >
                  {tr("Dupliquer", "Duplicate")}
                </button>
                <button
                  onClick={() =>
                    change((p) => {
                      removeResource(p, tab as ResourceKind, resource.id);
                      setSelected("");
                    })
                  }
                >
                  {tr("Supprimer", "Delete")}
                </button>
                {sheet && (
                  <button
                    onClick={async () => {
                      try {
                        const f = await chooseFile(["png"]);
                        if (f) {
                          setReimportId(sheet.id);
                          setImportPalette(sheet.paletteId);
                          setImported(f);
                          setModal("import");
                        }
                      } catch (e) {
                        report(String(e));
                      }
                    }}
                  >
                    {tr("Réimporter le dessin", "Reimport drawing")}
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
        {tab === "sheets" && sheet ? (
          <Drawing
            key={sheet.id}
            project={project}
            sheet={sheet}
            change={change}
            paletteId={paletteId || sheet.paletteId}
            setPalette={setPalette}
          />
        ) : tab === "palettes" && palette ? (
          <Palettes
            key={palette.id}
            project={project}
            palette={palette}
            change={change}
            select={setSelected}
          />
        ) : tab === "actors" && actor ? (
          <Sprites
            key={actor.id}
            project={project}
            actor={actor}
            change={change}
            onEditSheet={(id) => {
              setReturnActor(actor.id);
              setTab("sheets");
              setSelected(id);
              setPalette("");
            }}
          />
        ) : tab === "maps" && map ? (
          <Maps key={map.id} project={project} map={map} change={change} />
        ) : tab === "scenes" && scene ? (
          <Scenes
            key={scene.id}
            project={project}
            scene={scene}
            change={change}
          />
        ) : tab === "exports" ? (
          <Exports project={project} change={change} report={report} />
        ) : (
          <div className="work">
            <Empty
              text={tr(
                "Créez une ressource avec le bouton +.",
                "Create an asset with the + button.",
              )}
            />
          </div>
        )}
      </div>
      <footer>
        <span>
          {notice ||
            `${project.sheets.length} ${tr("dessins", "graphics")} · ${project.palettes.length} palettes`}
        </span>
        {notice && <button onClick={() => setNotice("")}>×</button>}
        <span className="footer-right">
          {dirty
            ? tr("Modifications non enregistrées", "Unsaved changes")
            : path
              ? tr("Enregistré", "Saved")
              : tr("Prêt", "Ready")}{" "}
          ·{" "}
          <select
            aria-label={tr("Fréquence", "Frame rate")}
            value={project.fps}
            onChange={(e) => {
              setTargetFps(+e.target.value as 50 | 60);
              setModal("fps");
            }}
          >
            <option value={60}>60 Hz</option>
            <option value={50}>50 Hz</option>
          </select>
        </span>
      </footer>
      {modal && (
        <div className="modal-shade">
          <section className="modal" role="dialog" aria-modal="true">
            <button
              className="close"
              aria-label={tr("Fermer", "Close")}
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "fps" && (
              <>
                <h2>
                  {tr("Passer à", "Switch to")} {targetFps} Hz
                </h2>
                <p>
                  {tr(
                    "Conserver les images console change la vitesse de lecture. Convertir les durées conserve leur durée en secondes, arrondie à une image console.",
                    "Keeping frame counts changes playback speed. Converting durations preserves their time in seconds, rounded to a console frame.",
                  )}
                </p>
                <div className="button-row">
                  {[false, true].map((convert) => (
                    <button
                      key={String(convert)}
                      onClick={() => {
                        change((p) => {
                          if (convert) {
                            const duration = (n: number) =>
                              Math.max(
                                1,
                                Math.min(
                                  65535,
                                  Math.round((n * targetFps) / p.fps),
                                ),
                              );
                            for (const a of p.actors)
                              for (const anim of a.animations)
                                for (const f of anim.frames)
                                  f.ticks = duration(f.ticks);
                            for (const a of p.palettes)
                              if (a.cycle)
                                a.cycle.ticks = duration(a.cycle.ticks);
                            for (const m of p.maps)
                              for (const a of m.animatedTiles)
                                a.ticks = duration(a.ticks);
                          }
                          p.fps = targetFps;
                        });
                        setModal(null);
                      }}
                    >
                      {convert
                        ? tr("Convertir les durées", "Convert durations")
                        : tr(
                            "Conserver les images console",
                            "Keep frame counts",
                          )}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal === "create" && (
              <>
                <h2>
                  {tr("Créer", "Create")} · {names[tab]}
                </h2>
                <Field label={tr("Nom", "Name")}>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                {["sheets", "maps"].includes(tab) && (
                  <div className="number-row">
                    <NumberField
                      label={tr("Largeur", "Width")}
                      value={width}
                      min={tab === "sheets" ? 8 : 1}
                      max={tab === "sheets" ? 512 : 128}
                      step={tab === "sheets" ? 8 : 1}
                      onChange={setWidth}
                    />
                    <NumberField
                      label={tr("Hauteur", "Height")}
                      value={height}
                      min={tab === "sheets" ? 8 : 1}
                      max={tab === "sheets" ? 512 : 128}
                      step={tab === "sheets" ? 8 : 1}
                      onChange={setHeight}
                    />
                  </div>
                )}
                {tab === "sheets" && (
                  <Select
                    label={tr("Profondeur", "Depth")}
                    value={bpp}
                    options={[2, 4, 8].map((v) => ({
                      value: v,
                      label: `${v} bpp`,
                    }))}
                    onChange={(v) => setBpp(+v as Bpp)}
                  />
                )}{" "}
                {tab === "palettes" && (
                  <Select
                    label={tr("Nombre d’entrées", "Entry count")}
                    value={newSize}
                    options={[4, 16, 256].map((v) => ({
                      value: v,
                      label: String(v),
                    }))}
                    onChange={(v) => setNewSize(+v)}
                  />
                )}
                <button className="primary" onClick={create}>
                  {tr("Créer", "Create")}
                </button>
              </>
            )}
            {(modal === "replace" || modal === "close") && (
              <>
                <h2>
                  {tr("Modifications non enregistrées", "Unsaved changes")}
                </h2>
                <p>
                  {tr(
                    "Enregistrez votre projet avant de le remplacer, ou abandonnez les modifications.",
                    "Save your project before replacing it, or discard changes.",
                  )}
                </p>
                <div className="button-row">
                  <button onClick={() => setModal(null)}>
                    {tr("Annuler", "Cancel")}
                  </button>
                  <button
                    onClick={() => {
                      if (modal === "close") {
                        dirtyRef.current = false;
                        void getCurrentWindow().destroy();
                      } else if (pending)
                        replace(
                          pending.project,
                          pending.path,
                          pending.recovered,
                        );
                    }}
                  >
                    {tr("Abandonner", "Discard")}
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      await save();
                      if (!dirtyRef.current) {
                        if (modal === "close")
                          void getCurrentWindow().destroy();
                        else if (pending)
                          replace(
                            pending.project,
                            pending.path,
                            pending.recovered,
                          );
                      }
                    }}
                  >
                    {tr("Enregistrer", "Save")}
                  </button>
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <h2>SNES Graph</h2>
                <p>
                  {tr(
                    "Dessinez avec des indices de couleur, assemblez vos sprites, puis composez et exportez vos scènes.",
                    "Draw with color indices, assemble sprites, then compose and export your scenes.",
                  )}
                </p>
                <dl>
                  <dt>Ctrl+S</dt>
                  <dd>{tr("Enregistrer", "Save")}</dd>
                  <dt>Ctrl+O</dt>
                  <dd>{tr("Ouvrir", "Open")}</dd>
                  <dt>Ctrl+Z / Ctrl+Shift+Z</dt>
                  <dd>{tr("Annuler / rétablir", "Undo / redo")}</dd>
                </dl>
                <p>
                  {tr(
                    "Une palette de sprite contient 15 couleurs visibles et une entrée transparente. Les variantes partagent les pixels et changent la palette.",
                    "A sprite palette contains 15 visible colors and a transparent entry. Variants share pixels and change the palette.",
                  )}
                </p>
                <Field label={tr("Nom du projet", "Project name")}>
                  <input
                    value={project.name}
                    onChange={(e) =>
                      change((p) => {
                        p.name = e.target.value;
                      })
                    }
                  />
                </Field>
              </>
            )}
            {modal === "import" && (
              <>
                <h2>{tr("Importer un dessin", "Import graphics")}</h2>
                <Select
                  label={tr("Palette", "Palette")}
                  value={importPalette}
                  options={[
                    {
                      value: "",
                      label: tr("Créer une palette", "Create palette"),
                    },
                    ...project.palettes.map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                  ]}
                  onChange={setImportPalette}
                />
                <Check
                  label={tr("Tramage", "Dithering")}
                  value={dither}
                  onChange={setDither}
                />
                {imp && (
                  <>
                    <div className="import-preview">
                      {originalImage && (
                        <figure>
                          <figcaption>{tr("Original", "Original")}</figcaption>
                          <img
                            className="pixel"
                            alt={tr(
                              "Image avant conversion",
                              "Image before conversion",
                            )}
                            src={originalImage}
                            style={{ maxWidth: 256, maxHeight: 256 }}
                          />
                        </figure>
                      )}
                      <figure>
                        <figcaption>
                          {tr("Conversion SNES", "SNES conversion")}
                        </figcaption>
                        <Preview
                          image={renderSheet(
                            {
                              ...project,
                              palettes: [...project.palettes, imp.palette],
                            },
                            imp.sheet,
                          )}
                          scale={Math.min(4, 256 / imp.sheet.width)}
                        />
                      </figure>
                    </div>
                    <p>
                      {imp.changed}{" "}
                      {tr(
                        "pixels avec une couleur ajustée",
                        "pixels with adjusted colors",
                      )}
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        if (!imp) return;
                        const added = imp;
                        const importedOk = change((p) => {
                          if (
                            !p.palettes.some((v) => v.id === added.palette.id)
                          )
                            p.palettes.push(added.palette);
                          if (reimportId) {
                            const current = p.sheets.find(
                              (s) => s.id === reimportId,
                            )!;
                            if (current.layers)
                              throw new Error(
                                tr(
                                  "Aplatissez les calques avant de réimporter ce dessin.",
                                  "Flatten layers before reimporting this drawing.",
                                ),
                              );
                            if (
                              current.width !== added.sheet.width ||
                              current.height !== added.sheet.height ||
                              current.bpp !== added.sheet.bpp
                            )
                              throw new Error(
                                tr(
                                  "Le réimport doit conserver les dimensions et la profondeur du dessin.",
                                  "Reimport must preserve drawing dimensions and depth.",
                                ),
                              );
                            current.pixels = added.sheet.pixels;
                            current.source = imported?.name;
                          } else {
                            added.sheet.source = imported?.name;
                            p.sheets.push(added.sheet);
                          }
                          if (added.actor && !reimportId)
                            p.actors.push(added.actor);
                        });
                        if (!importedOk) return;
                        setSelected(reimportId || added.sheet.id);
                        setReimportId("");
                        setPalette(added.palette.id);
                        setModal(null);
                      }}
                    >
                      {tr("Importer", "Import")}
                    </button>
                  </>
                )}
                {importError && <p className="error">{importError}</p>}
              </>
            )}
            {modal === "usages" && resource && (
              <>
                <h2>{resource.name}</h2>
                <p>
                  {uses(project, resource.id).join(", ") ||
                    tr(
                      "Aucun usage dans le projet.",
                      "No uses in this project.",
                    )}
                </p>
                <Select
                  label={tr(
                    "Remplacer les références par",
                    "Replace references with",
                  )}
                  value={replacement}
                  options={[
                    { value: "", label: "—" },
                    ...items
                      .filter((r) => r.id !== resource.id)
                      .map((r) => ({ value: r.id, label: r.name })),
                  ]}
                  onChange={setReplacement}
                />
                <button
                  disabled={!replacement}
                  onClick={() => {
                    change((p) =>
                      replaceReferences(
                        p,
                        tab as ResourceKind,
                        resource.id,
                        replacement,
                      ),
                    );
                    setModal(null);
                  }}
                >
                  {tr("Remplacer dans le projet", "Replace throughout project")}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
