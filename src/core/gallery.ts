import { strToU8 } from "fflate";
import { validateProject } from "./archive";
import {
  buildTiles,
  defaultExport,
  encodeTiles,
  exportProject,
  objectLoad,
  packSprites,
} from "./snes";
import { compileScene, type SceneMemory } from "./scene-export";
import { sceneFrame } from "./demo";
import {
  makeScene,
  makeLayer,
  OBJ_SIZES,
  type Project,
  type ExportSet,
  type Scene,
} from "./model";
import { stampRomLogo, ROM_LOGO } from "./rom-logo";
import { galleryRuntime } from "./gallery-runtime";
import { galleryFont, galleryText } from "./gallery-font";

export type ExportKind = "assets" | "scene" | "gallery";
export type GalleryLanguage = "fr" | "en";
const hex = (n: number) => "$" + (n & 65535).toString(16);
const wr = (a: number, v: number) =>
  `  lda #${hex(v & 255)}\n  sta ${hex(a)}\n`;
const set = (name: string, n: number) => `  lda #${hex(n)}\n  sta ${name}\n`;
const dma = (label: string, size: number, port = 0x18, mode = 1) =>
  wr(0x4300, mode) +
  wr(0x4301, port) +
  `  ldx #.loword(${label})\n  stx $4302\n  lda #^${label}\n  sta $4304\n  ldx #${size}\n  stx $4305\n` +
  wr(0x420b, 1);

/** Resolve each view independently; dependencies never add gallery entries. */
export function gallerySelection(p: Project, opt: ExportSet) {
  const select = <T extends { id: string }>(
    all: T[],
    ids: string[],
    name: string,
  ) => {
    for (const id of ids)
      if (!all.some((r) => r.id === id))
        throw new Error(`${name}: missing resource ${id}`);
    return all.filter((r) => ids.includes(r.id));
  };
  const result = {
    actors: select(p.actors, opt.actorIds, "Sprites"),
    maps: select(p.maps, opt.mapIds, "Maps"),
    scenes: select(
      p.scenes,
      opt.gallerySceneIds ?? p.scenes.map((s) => s.id),
      "Scenes",
    ),
  };
  if (!result.actors.length && !result.maps.length && !result.scenes.length)
    throw new Error(
      "Galerie vide / Empty gallery: select a character, map or scene",
    );
  return result;
}
function dependencies(
  p: Project,
  opt: ExportSet,
  actors: string[],
  maps: string[],
  scene?: Scene,
): ExportSet {
  const actorIds = [
    ...new Set([...actors, ...(scene?.instances.map((i) => i.actorId) ?? [])]),
  ];
  const mapIds = [
    ...new Set([
      ...maps,
      ...(scene?.layers.filter((l) => l.enabled).map((l) => l.mapId) ?? []),
    ]),
  ];
  const sheetIds = new Set<string>(),
    paletteIds = new Set<string>();
  for (const id of actorIds) {
    const a = p.actors.find((a) => a.id === id);
    if (!a) throw new Error(`Missing character ${id}`);
    for (const pose of a.poses)
      for (const c of pose.pieces) {
        sheetIds.add(c.sheetId);
        paletteIds.add(c.paletteId);
      }
    for (const v of a.variants)
      for (const id of Object.values(v.palettes)) paletteIds.add(id);
  }
  for (const id of mapIds) {
    const m = p.maps.find((m) => m.id === id);
    if (!m) throw new Error(`Missing map ${id}`);
    sheetIds.add(m.sheetId);
    for (const c of [...m.cells, ...m.stamps.flatMap((s) => s.cells)])
      paletteIds.add(c.paletteId);
  }
  for (const id of sheetIds) {
    const s = p.sheets.find((s) => s.id === id);
    if (!s) throw new Error(`Missing drawing ${id}`);
    paletteIds.add(s.paletteId);
  }
  for (const slot of scene?.paletteSlots ?? []) paletteIds.add(slot.paletteId);
  return {
    ...opt,
    sceneId: scene?.id ?? "",
    actorIds,
    mapIds,
    sheetIds: [...sheetIds],
    paletteIds: [...paletteIds],
  };
}
// The asset exporter requires nonempty animation records. A temporary static
// record lets the gallery also display pose-only actors without editing a project.
function staticPoseProject(p: Project): Project {
  return {
    ...p,
    actors: p.actors.map((a) => {
      const fallback = a.poses[0];
      if (!fallback) return a;
      const frames = [{ poseId: fallback.id, ticks: 1, event: "" }];
      return {
        ...a,
        animations: a.animations.length
          ? a.animations.map((animation) =>
              animation.frames.length ? animation : { ...animation, frames },
            )
          : [
              {
                id: "gallery-static-" + a.id,
                name: "Static",
                loop: false,
                pingPong: false,
                frames,
              },
            ],
      };
    }),
  };
}

export function gallerySources(
  p: Project,
  opt = defaultExport(p),
  ticks = p.fps * 2,
  language: GalleryLanguage = "fr",
): Record<string, Uint8Array> {
  const selectedProject = p;
  p = staticPoseProject(p);
  validateProject(p);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 600)
    throw new Error("Scene duration: 1…600 frames");
  const selection = gallerySelection(selectedProject, opt),
    files: Record<string, Uint8Array> = {};
  const farCalls = new Set<string>();
  const banks: string[] = [""];
  const sizes = [0];
  let serial = 0;
  // Every data block and DMA source remains inside one 32 KiB LoROM bank.
  const add = (
    code: string,
    data: { name: string; data: Uint8Array }[] = [],
  ) => {
    code = code.replace(/\bjsr (\w+)/g, (_, name) => {
      farCalls.add(name);
      return `jsl Far${name}`;
    });
    const bytes =
      (code ? code.split("\n").length * 4 : 0) +
      data.reduce((n, d) => n + d.data.length, 0);
    if (bytes > 32768) throw new Error("Gallery record exceeds one ROM bank");
    let b = banks.length - 1;
    if (b === 0 || sizes[b] + bytes > 32768) {
      b = banks.length;
      banks.push("");
      sizes.push(0);
    }
    if (b >= 128) throw new Error("Gallery exceeds 4 MiB LoROM");
    sizes[b] += bytes;
    banks[b] += code;
    for (const d of data) {
      files[d.name + ".bin"] = d.data;
      banks[b] += `${d.name}: .incbin "${d.name}.bin"\n`;
    }
  };
  const blob = (data: Uint8Array) => {
    const name = "Data" + serial++;
    add("", [{ name, data }]);
    return name;
  };
  const routine = (body: string) => {
    const label = "Routine" + serial++;
    add(`${label}:\n${body}  rtl\n`);
    return label;
  };
  const table = (labels: string[]) => {
    const label = "Table" + serial++;
    add(`${label}:\n${labels.map((l) => `.faraddr ${l}\n`).join("")}`);
    return label;
  };
  const callTable = (label: string, index: string) =>
    `  lda ${index}\n  asl\n  clc\n  adc ${index}\n  tax\n  lda f:${label},x\n  sta PTR\n  sep #$20\n  .a8\n  lda f:${label}+2,x\n  sta PTR+2\n  rep #$20\n  .a16\n  jsl Dispatch\n`;
  const font = galleryFont(),
    fontLabel = blob(font.data),
    fontPal = blob(Uint8Array.from([0, 0, 255, 127, 0, 0, 0, 0]));
  const text = (value: string, row: number) => {
    const label = blob(galleryText(value, font.chars));
    return `  lda #.loword(${label})\n  sta PTR\n  sep #$20\n  .a8\n  lda #^${label}\n  sta PTR+2\n  rep #$20\n  .a16\n  ldx #${row * 64 + 4}\n  jsr Print\n`;
  };
  const logoTiles = (m: SceneMemory) => {
    const a = m.allocations.find((a) => a.name === ROM_LOGO)!;
    return (
      wr(0x2115, 0x80) +
      `  ldx #${a.address / 2}\n  stx $2116\n` +
      dma(blob(m.vram.slice(a.address, a.address + a.bytes)), a.bytes)
    );
  };
  const textMemory = compileScene(
    p,
    makeScene(),
    {},
    { data: new Uint8Array(), starts: {} },
    new Map(),
  );
  textMemory.allocations.push({ name: "Text", address: 0, bytes: 10240 });
  stampRomLogo(textMemory, p, 224);
  const textLogo =
    logoTiles(textMemory) +
    wr(0x2101, 0) +
    wr(0x2102, 0) +
    wr(0x2103, 0) +
    dma(blob(textMemory.oam), 544, 4, 0) +
    wr(0x2121, 128) +
    dma(blob(textMemory.cgram.slice(256, 288)), 32, 0x22, 0);
  const tr = (fr: string, en: string) =>
    (language === "fr" ? fr : en)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  let shell = galleryRuntime;
  shell += `TextScreen:\n  jsr ResetPPU\n  lda #0\n  ldx #2046\n: sta $7e2000,x\n  dex\n  dex\n  bpl :-\n  sep #$20\n  .a8\n  ldx #0\n  stx $2116\n${dma(fontLabel, font.data.length)}${wr(0x2121, 0)}${dma(fontPal, 8, 0x22, 0)}${textLogo}${wr(0x2107, 0x10)}${wr(0x212c, 17)}${wr(0x210e, 255)}${wr(0x210e, 255)}  rep #$20\n  .a16\n  rts\n`;
  const categories = [
    selection.actors.length ? tr("Sprites", "Sprites") : "",
    selection.maps.length ? tr("Cartes", "Maps") : "",
    selection.scenes.length ? tr("Scènes", "Scenes") : "",
  ].filter(Boolean);
  const counts = [
      selection.actors.length,
      selection.maps.length,
      selection.scenes.length,
    ].filter(Boolean),
    firsts: number[] = [];
  let total = 0;
  for (const n of counts) {
    firsts.push(total);
    total += n;
  }
  const menus = categories.map((_, selected) =>
    routine(
      text(p.name, 3) +
        categories
          .map((c, i) => text((selected === i ? "X " : "  ") + c, 9 + i * 3))
          .join("") +
        text(
          tr("Croix : choisir   A : ouvrir", "D-pad: select     A: open"),
          23,
        ),
    ),
  );
  const menuTable = table(menus);
  shell += `CategoryCount = ${categories.length}\nCategoryFirst: .word ${firsts.join(",")}\nCategoryEnd: .word ${counts.map((n, i) => firsts[i] + n).join(",")}\nShowMenu:\n  jsr Black\n  jsr TextScreen\n${callTable(menuTable, "CATEGORY")}  jsr UploadText\n  rts\n`;
  const entries: {
    init: string;
    update: string;
    draw: string;
    info: string;
  }[] = [];
  const loadMemory = (m: SceneMemory) => {
    let code = "  jsr ResetPPU\n  sep #$20\n  .a8\n";
    for (let offset = 0; offset < 65536; offset += 32768) {
      const label = blob(m.vram.slice(offset, offset + 32768));
      code += `  ldx #${offset / 2}\n  stx $2116\n` + dma(label, 32768);
    }
    code +=
      wr(0x2102, 0) +
      wr(0x2103, 0) +
      dma(blob(m.oam), 544, 4, 0) +
      wr(0x2121, 0) +
      dma(blob(m.cgram), 512, 0x22, 0);
    for (const [a, v] of m.registers) code += wr(a, v);
    return code + "  rep #$20\n  .a16\n";
  };
  const compile = (project: Project, scene: Scene, options: ExportSet) => {
    project = {
      ...staticPoseProject(project),
      exports: [],
      scenes: [],
      actors: staticPoseProject(project).actors.filter((a) =>
        options.actorIds.includes(a.id),
      ),
      maps: project.maps.filter((m) => options.mapIds.includes(m.id)),
      sheets: project.sheets.filter((s) => options.sheetIds.includes(s.id)),
      palettes: project.palettes.filter((p) =>
        options.paletteIds.includes(p.id),
      ),
    };
    if ([5, 6].includes(scene.mode) && (options.deduplicate || options.flips))
      throw new Error(
        "High-resolution scenes require consecutive tiles: disable deduplication and mirrors",
      );
    const assets = exportProject(project, { ...options, sceneId: "" }),
      packed = packSprites(project, options.actorIds),
      built = new Map(
        options.sheetIds.map((id) => [id, buildTiles(project, id, options)]),
      );
    return (tick = 0) => {
      const load = objectLoad(project, scene, tick);
      if (
        load.total > 128 ||
        load.rows.some((r) => r.sprites > 32 || r.slivers > 34)
      )
        throw new Error("OBJ limit exceeded (total or scanline)");
      return stampRomLogo(
        compileScene(project, scene, assets, packed, built, tick),
        project,
        scene.height,
      );
    };
  };
  const infoBase = (name: string, index: number, count: number) =>
    text(name, 2) +
    text(`${index + 1} / ${count}`, 4) +
    text(tr("L/R : précédent / suivant", "L/R: previous / next"), 18) +
    text(tr("Start : fermer   B : retour", "Start: close     B: back"), 24);
  const togglePause = `  lda PRESSED\n  and #$0080\n  beq :+\n  lda PAUSED\n  eor #1\n  sta PAUSED\n: `;
  const wrapped = (name: string, run: () => void) => {
    try {
      run();
    } catch (e) {
      throw new Error(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  selection.actors.forEach((actor, actorIndex) =>
    wrapped(actor.name, () => {
      const pieces = actor.poses.flatMap((p) => p.pieces);
      if (!pieces.length)
        throw new Error("Aucune pose affichable / No displayable pose");
      const objSize = OBJ_SIZES.findIndex((pair) =>
        pieces.every((c) => pair.includes(c.size)),
      );
      if (objSize < 0) throw new Error("Incompatible OBJ sizes across poses");
      const left = Math.min(...pieces.map((c) => c.x)),
        top = Math.min(...pieces.map((c) => c.y)),
        right = Math.max(...pieces.map((c) => c.x + c.size)),
        bottom = Math.max(...pieces.map((c) => c.y + c.size));
      if (right - left > 256 || bottom - top > 224)
        throw new Error("Character exceeds the gallery viewport (256 × 224)");
      const scene = { ...makeScene(), objSize, backdrop: 0 };
      scene.instances = [
        {
          id: "gallery",
          actorId: actor.id,
          animationId: "",
          variantId: "",
          x: Math.floor((256 - right + left) / 2) - left + actor.originX,
          y: Math.floor((224 - bottom + top) / 2) - top + actor.originY,
          vx: 0,
          vy: 0,
          flipX: false,
        },
      ];
      const options = dependencies(p, opt, [actor.id], []);
      const variants = ["", ...actor.variants.map((v) => v.id)];
      const memories = variants.map((variant) =>
        actor.poses.map((pose) => {
          const a = {
            ...actor,
            poses: [pose, ...actor.poses.filter((v) => v !== pose)],
          };
          const project = {
            ...p,
            actors: p.actors.map((v) => (v.id === a.id ? a : v)),
          };
          const s = {
            ...scene,
            instances: [{ ...scene.instances[0], variantId: variant }],
          };
          return compile(project, s, { ...options, sceneId: s.id })(0);
        }),
      );
      const poseTables = memories.map((states) =>
        table(
          states.map((m) =>
            routine(
              "  sep #$20\n  .a8\n" +
                logoTiles(m) +
                wr(0x2102, 0) +
                wr(0x2103, 0) +
                dma(blob(m.oam), 544, 4, 0) +
                wr(0x2121, 0) +
                dma(blob(m.cgram), 512, 0x22, 0) +
                "  rep #$20\n  .a16\n",
            ),
          ),
        ),
      );
      const animations = actor.animations.filter((a) => a.frames.length);
      const sequences = animations.length
        ? animations.map((a) => {
            const frames = [...a.frames];
            if (a.pingPong && frames.length > 2)
              frames.push(...frames.slice(1, -1).reverse());
            return { name: a.name, loop: a.loop, frames };
          })
        : actor.poses.map((pose) => ({
            name: pose.name,
            loop: false,
            frames: [{ poseId: pose.id, ticks: 1 }],
          }));
      const drawSequences = sequences.map((seq) => {
        const bytes = new Uint8Array(seq.frames.length * 2);
        const view = new DataView(bytes.buffer);
        seq.frames.forEach((f, i) =>
          view.setUint16(
            i * 2,
            actor.poses.findIndex((p) => p.id === f.poseId),
            true,
          ),
        );
        const poses = blob(bytes);
        const choices = poseTables.map((t) =>
          routine(
            `  lda FRAME\n  asl\n  tax\n  lda f:${poses},x\n  sta CELL\n${callTable(t, "CELL")}`,
          ),
        );
        return routine(callTable(table(choices), "VARIANT"));
      });
      const draw = routine(
        callTable(table(drawSequences), "ANIMATION") +
          `  sep #$20\n  .a8\n  stz $2121\n  rep #$20\n  .a16\n  lda BACKDROP\n  asl\n  tax\n  lda f:BackdropColors,x\n  sep #$20\n  .a8\n  sta $2122\n  xba\n  sta $2122\n  rep #$20\n  .a16\n`,
      );
      const steps = sequences.map((seq) => {
        const dur = new Uint8Array(seq.frames.length * 2);
        seq.frames.forEach((f, i) =>
          new DataView(dur.buffer).setUint16(i * 2, f.ticks, true),
        );
        const durations = blob(dur);
        return routine(
          `  lda PRESSED\n  and #$0080\n  beq :+\n  lda ENDED\n  beq :+\n  stz FRAME\n  stz TIMER\n  stz ENDED\n  stz PAUSED\n  rtl\n: lda PAUSED\n  beq Playing${serial}\n  lda PRESSED\n  and #$0300\n  beq Done${serial}\n  stz TIMER\n  stz ENDED\n  lda PRESSED\n  and #$0200\n  beq Next${serial}\n  lda FRAME\n  bne :+\n  lda #${seq.frames.length}\n: dec\n  sta FRAME\n  rtl\nPlaying${serial}:\n${animations.length ? `  inc TIMER\n  lda FRAME\n  asl\n  tax\n  lda TIMER\n  cmp f:${durations},x\n  bcc Done${serial}\n  stz TIMER\n` : `  rtl\n`}Next${serial}:\n  inc FRAME\n  lda FRAME\n  cmp #${seq.frames.length}\n  bcc Done${serial}\n${seq.loop ? "  stz FRAME\n" : `  lda PAUSED\n  beq :+\n  stz FRAME\n  rtl\n: dec FRAME\n  lda #1\n  sta PAUSED\n  sta ENDED\n`}Done${serial}:\n`,
        );
      });
      const update = routine(
        `  lda PRESSED\n  and #$0c00\n  beq ChangedAnim${serial}\n  lda PRESSED\n  and #$0800\n  beq DownAnim${serial}\n  lda ANIMATION\n  bne :+\n  lda #${sequences.length}\n: dec\n  sta ANIMATION\n  bra ResetAnim${serial}\nDownAnim${serial}:\n  inc ANIMATION\n  lda ANIMATION\n  cmp #${sequences.length}\n  bcc ResetAnim${serial}\n  stz ANIMATION\nResetAnim${serial}:\n  stz FRAME\n  stz TIMER\n  stz ENDED\n  stz PAUSED\nChangedAnim${serial}:\n  lda PRESSED\n  and #$0040\n  beq :+\n  inc VARIANT\n  lda VARIANT\n  cmp #${variants.length}\n  bcc :+\n  stz VARIANT\n: lda PRESSED\n  and #$4000\n  beq :+\n  inc BACKDROP\n  lda BACKDROP\n  cmp #3\n  bcc :+\n  stz BACKDROP\n:\n${togglePause}${callTable(table(steps), "ANIMATION")}`,
      );
      const init = routine(loadMemory(memories[0][0]) + `  jsl ${draw}\n`);
      const animNames = table(sequences.map((s) => routine(text(s.name, 7))));
      const variantNames = table(
        [
          tr("Palette originale", "Original palette"),
          ...actor.variants.map((v) => v.name),
        ].map((s) => routine(text(s, 9))),
      );
      const info = routine(
        infoBase(actor.name, actorIndex, selection.actors.length) +
          callTable(animNames, "ANIMATION") +
          callTable(variantNames, "VARIANT") +
          text(
            tr("Haut/Bas : animation ou pose", "Up/Down: animation or pose"),
            12,
          ) +
          text(tr("A : lecture / pause", "A: play / pause"), 13) +
          text(
            tr("Gauche/Droite : image (pause)", "Left/Right: frame (paused)"),
            14,
          ) +
          text(tr("X : palette   Y : fond", "X: palette    Y: backdrop"), 15),
      );
      entries.push({ init, draw, update, info });
    }),
  );
  selection.maps.forEach((map, mapIndex) =>
    wrapped(map.name, () => {
      const sheet = p.sheets.find((s) => s.id === map.sheetId)!;
      const built = buildTiles(p, sheet.id, opt);
      const animations = map.animatedTiles.filter((a) => a.frames.length);
      const pixels = [...built.pixels];
      const animatedSlots = new Map<number, number>();
      // Animated sources receive dedicated slots: updating them cannot alter a deduplicated static tile.
      for (const a of animations) {
        animatedSlots.set(a.tile, pixels.length / 64);
        pixels.push(...new Uint8Array(64));
      }
      const blank = pixels.length / 64;
      pixels.push(...new Uint8Array(64));
      if (pixels.length / 64 > 1024)
        throw new Error(
          "BG exceeds 1024 tiles including animated slots and border",
        );
      const tileBytes = encodeTiles(Uint8Array.from(pixels), sheet.bpp);
      const options = dependencies(p, opt, [], [map.id]);
      const scene = {
        ...makeScene(),
        mode: sheet.bpp === 2 ? 0 : sheet.bpp === 4 ? 1 : 3,
        backdrop: 0,
        layers: [makeLayer(map.id)],
      };
      const paletteCells = [
        ...new Map(map.cells.map((c) => [c.paletteId, c])).values(),
      ];
      const preview = {
        ...map,
        width: 64,
        height: 32,
        animatedTiles: [],
        cells: Array.from(
          { length: 2048 },
          (_, i) => paletteCells[i % paletteCells.length],
        ),
      };
      const m = stampRomLogo(
        compileScene(
          { ...p, maps: p.maps.map((v) => (v.id === map.id ? preview : v)) },
          scene,
          { [`tiles/${sheet.id}.chr`]: tileBytes },
          { data: new Uint8Array(), starts: {} },
          new Map([[sheet.id, { ...built, pixels: Uint8Array.from(pixels) }]]),
        ),
        p,
        224,
      );
      const base =
        m.allocations.find((a) => a.resource === map.id)!.address / 2;
      const rowLabels = [];
      for (let y = 0; y < map.height; y++) {
        const bytes = new Uint8Array(map.width * 2),
          view = new DataView(bytes.buffer);
        for (let x = 0; x < map.width; x++) {
          const c = map.cells[y * map.width + x],
            ref = built.refs[c.tile];
          const slot = m.palettes.find(
            (v) => v.id === c.paletteId && v.layer === 0,
          )!.slot;
          const animated = animatedSlots.get(c.tile);
          view.setUint16(
            x * 2,
            (animated ?? ref.tile) |
              (slot << 10) |
              (+c.priority << 13) |
              (+(c.flipX !== (animated === undefined && ref.flipX)) << 14) |
              (+(c.flipY !== (animated === undefined && ref.flipY)) << 15),
            true,
          );
        }
        rowLabels.push(blob(bytes));
      }
      const rows = table(rowLabels);
      let animUpdate = "",
        animDraw = "",
        dmaBytes = 192;
      const sourceBuilt = buildTiles(p, sheet.id, {
        ...options,
        deduplicate: false,
        flips: false,
        reservedTiles: 0,
      });
      animations.forEach((a, i) => {
        if (i >= 256) throw new Error("Too many simultaneous tile animations");
        const timer = hex(0x1000 + i * 4),
          frame = hex(0x1002 + i * 4);
        animUpdate += `  inc ${timer}\n  lda ${timer}\n  cmp #${a.ticks}\n  bcc :+\n  stz ${timer}\n  inc ${frame}\n  lda ${frame}\n  cmp #${a.frames.length}\n  bcc :+\n  stz ${frame}\n:\n`;
        const draws = a.frames.map((source) => {
          // Decode from original pixels so animated tiles retain their own flips.
          const bytes = encodeTiles(
            sourceBuilt.pixels.slice(source * 64, source * 64 + 64),
            sheet.bpp,
          );
          return routine(
            `  sep #$20\n  .a8\n${wr(0x2115, 0x80)}  ldx #${animatedSlots.get(a.tile)! * sheet.bpp * 4}\n  stx $2116\n${dma(blob(bytes), bytes.length)}  rep #$20\n  .a16\n`,
          );
        });
        dmaBytes += sheet.bpp * 8;
        animDraw += callTable(table(draws), frame);
      });
      // All palette cycles are evaluated through compact per-cycle tables, not a video loop.
      let cycleIndex = animations.length;
      for (const assignment of m.palettes) {
        const pal = p.palettes.find((p) => p.id === assignment.id)!;
        if (!pal.cycle) continue;
        const c = pal.cycle,
          len = c.end - c.start + 1,
          index = cycleIndex++;
        if (index >= 256) throw new Error("Too many palette/tile clocks");
        const timer = hex(0x1000 + index * 4),
          frame = hex(0x1002 + index * 4),
          size = 1 << sheet.bpp;
        animUpdate += `  inc ${timer}\n  lda ${timer}\n  cmp #${c.ticks}\n  bcc :+\n  stz ${timer}\n  inc ${frame}\n  lda ${frame}\n  cmp #${len}\n  bcc :+\n  stz ${frame}\n:\n`;
        const draws = Array.from({ length: len }, (_, phase) => {
          const bytes = new Uint8Array((size - 1) * 2),
            v = new DataView(bytes.buffer);
          for (let k = 1; k < size; k++)
            v.setUint16(
              (k - 1) * 2,
              pal.colors[
                k >= c.start && k <= c.end
                  ? c.start + ((k - c.start - phase + len) % len)
                  : k
              ],
              true,
            );
          return routine(
            "  sep #$20\n  .a8\n" +
              wr(0x2121, assignment.address + 1) +
              dma(blob(bytes), bytes.length, 0x22, 0) +
              "  rep #$20\n  .a16\n",
          );
        });
        dmaBytes += (size - 1) * 2;
        animDraw += callTable(table(draws), frame);
      }
      if (
        dmaBytes * 8 + cycleIndex * 3200 + 8192 >
        ((p.fps === 50 ? 312 : 262) - 224 - 2) * 1364
      )
        throw new Error(
          "Animated map transfers exceed the gallery vblank budget",
        );
      const draw = routine(`  jsr MapCommit\n${animDraw}`);
      const init = routine(
        loadMemory(m) +
          set("MAPWIDTH", map.width) +
          set("MAPHEIGHT", map.height) +
          set("MAXX", Math.max(0, map.width * 8 - 256)) +
          set("MAXY", Math.max(0, map.height * 8 - 224)) +
          set("CENTERX", Math.max(0, Math.floor((256 - map.width * 8) / 2))) +
          set("CENTERY", Math.max(0, Math.floor((224 - map.height * 8) / 2))) +
          set("MAPBASE", base) +
          set("BLANK", blank) +
          `  lda #.loword(${rows})\n  sta MAPROWS\n  sep #$20\n  .a8\n  lda #^${rows}\n  sta MAPROWS+2\n  rep #$20\n  .a16\n  jsr MapPosition\n  lda WORLDY\n  sta OLDY\n  clc\n  adc #32\n  sta OLDX\n: jsr MapRow\n  inc WORLDY\n  lda WORLDY\n  cmp OLDX\n  bne :-\n  jsr MapPosition\n  lda WORLDX\n  sta OLDX\n  lda WORLDY\n  sta OLDY\n  sep #$20\n  .a8\n${wr(0x2115, 0x80)}  ldx #${base}\n  stx $2116\n${wr(0x4300, 1)}${wr(0x4301, 0x18)}  ldx #$3000\n  stx $4302\n${wr(0x4304, 0x7e)}  ldx #4096\n  stx $4305\n${wr(0x420b, 1)}  rep #$20\n  .a16\n  jsl ${draw}\n`,
      );
      entries.push({
        init,
        draw,
        update: routine(`  jsr MapPrepare\n${animUpdate}`),
        info: routine(
          infoBase(map.name, mapIndex, selection.maps.length) +
            text(`${map.width * 8} × ${map.height * 8} px`, 7) +
            text(tr("Croix : déplacer la caméra", "D-pad: move camera"), 12) +
            text(tr("Maintenir A : accélérer", "Hold A: move faster"), 14),
        ),
      });
    }),
  );
  selection.scenes.forEach((scene, sceneIndex) =>
    wrapped(scene.name, () => {
      const options = dependencies(p, opt, [], [], scene),
        memory = compile(p, scene, options);
      const first = memory(0);
      let previous = memory(ticks - 1);
      const frames: string[] = [];
      for (let tick = 0; tick < ticks; tick++) {
        const m = tick === 0 ? first : memory(tick),
          label = "SceneFrame" + serial++;
        const frame = sceneFrame(m, previous, label, scene.height, p.fps);
        const code = frame.code
          .replace("sta $420c\n  rtl", "sta HDMAMASK\n  rtl")
          .replace(`${label}:\n`, `${label}:\n  sep #$20\n  .a8\n`)
          .replace("  rtl\n", "  rep #$20\n  .a16\n  rtl\n");
        add(code, frame.chunks);
        frames.push(label);
        previous = m;
      }
      const frameTable = table(frames),
        draw = routine(callTable(frameTable, "TICK"));
      // Replay deltas under forced blank when returning from the information screen.
      const init = routine(
        loadMemory(first) +
          `  lda TICK\n  pha\n  stz TICK\nRestore${serial}:\n  jsl ${draw}\n  lda TICK\n  cmp 1,s\n  beq :+\n  inc TICK\n  bra Restore${serial}\n: pla\n  sta TICK\n`,
      );
      const update = routine(
        togglePause +
          `  lda PAUSED\n  bne :+\n  inc TICK\n  lda TICK\n  cmp #${ticks}\n  bcc :+\n  stz TICK\n:\n`,
      );
      entries.push({
        init,
        draw,
        update,
        info: routine(
          infoBase(scene.name, sceneIndex, selection.scenes.length) +
            text(tr("A : lecture / pause", "A: play / pause"), 12) +
            text(tr(`Boucle : ${ticks} images`, `Loop: ${ticks} frames`), 14),
        ),
      });
    }),
  );
  for (const [key, suffix] of [
    ["init", "Init"],
    ["update", "Update"],
    ["draw", "Draw"],
    ["info", "Info"],
  ] as const) {
    const label = table(entries.map((e) => e[key]));
    shell += `Call${suffix}:\n  txa\n  sta PTR\n  asl\n  clc\n  adc PTR\n  tax\n  lda f:${label},x\n  sta PTR\n  sep #$20\n  .a8\n  lda f:${label}+2,x\n  sta PTR+2\n  rep #$20\n  .a16\n  jsl Dispatch\n  rts\n`;
  }
  for (const name of farCalls) shell += `Far${name}:\n  jsr ${name}\n  rtl\n`;
  shell += "BackdropColors: .word $0000,$4210,$7fff\n";
  let count = 4;
  while (count < banks.length) count *= 2;
  if (count > 128) throw new Error("Gallery exceeds 4 MiB LoROM");
  let cfg = "MEMORY {\n";
  for (let n = 0; n < count; n++)
    cfg += ` B${n}: start=$${((n >= 126 ? n + 128 : n) * 65536 + 32768).toString(16)}, size=$8000, file=%O, fill=yes;\n`;
  cfg +=
    "}\nSEGMENTS {\n CODE: load=B0,type=ro;\n HEADER: load=B0,type=ro,start=$FFC0;\n VECTORS: load=B0,type=ro,start=$FFE0;\n";
  for (let n = 1; n < count; n++) {
    cfg += ` DATA${n}: load=B${n},type=ro,optional=yes;\n`;
    shell += `.segment "DATA${n}"\n${banks[n] ?? ""}`;
  }
  cfg += "}\n";
  shell += `.segment "HEADER"\n.byte "SNES GRAPH GALLERY   "\n.byte $20,$00,${Math.log2(count * 32)},$00,${p.fps === 50 ? 2 : 1},$00,$00\n.word $ffff,$0000\n.segment "VECTORS"\n.word 0,0,Irq,Irq,Irq,Irq,0,Irq\n.word 0,0,Irq,0,Irq,Irq,Reset,Irq\n`;
  files["main.s"] = strToU8(shell);
  files["lorom.cfg"] = strToU8(cfg);
  files["README.txt"] = strToU8(
    `SNES Graph gallery (${language}, ${p.fps} Hz)\nca65 main.s -o main.o\nld65 -C lorom.cfg main.o -o gallery.sfc\nPort 1: D-pad / A select; L/R browse; Start information; B back.\nSprites: Up/Down animation, A pause, Left/Right step, X palette, Y backdrop.\nMaps: D-pad camera, hold A for speed. Scenes: A pause.\nScenes loop ${ticks} console frames. No game logic or audio.\nHardware validation is separate from emulator validation.\n`,
  );
  return files;
}
