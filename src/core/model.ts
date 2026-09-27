export type Bpp = 2 | 4 | 8;
export type Palette = {
  id: string;
  name: string;
  colors: number[];
  labels: string[];
  locked: boolean[];
  cycle?: { start: number; end: number; ticks: number };
};
export type Sheet = {
  id: string;
  name: string;
  width: number;
  height: number;
  bpp: Bpp;
  pixels: Uint8Array;
  paletteId: string;
  source?: string;
  layers?: {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    pixels: Uint8Array;
  }[];
};
export type Piece = {
  id: string;
  sheetId: string;
  sx: number;
  sy: number;
  size: number;
  x: number;
  y: number;
  paletteId: string;
  flipX: boolean;
  flipY: boolean;
  priority: number;
  group: string;
};
export type Box = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Pose = {
  id: string;
  name: string;
  pieces: Piece[];
  boxes: Box[];
  anchors: { name: string; x: number; y: number }[];
};
export type Animation = {
  id: string;
  name: string;
  loop: boolean;
  pingPong: boolean;
  frames: { poseId: string; ticks: number; event: string }[];
};
export type Variant = {
  id: string;
  name: string;
  palettes: Record<string, string>;
};
export type Actor = {
  id: string;
  name: string;
  originX: number;
  originY: number;
  poses: Pose[];
  animations: Animation[];
  variants: Variant[];
};
export type Cell = {
  tile: number;
  paletteId: string;
  flipX: boolean;
  flipY: boolean;
  priority: boolean;
  collision: number;
  directColor?: number;
  terrain?: string;
};
export type Metatile = {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Cell[];
};
export type Tilemap = {
  id: string;
  name: string;
  sheetId: string;
  width: number;
  height: number;
  cells: Cell[];
  stamps: Metatile[];
  animatedTiles: {
    name?: string;
    tile: number;
    frames: number[];
    ticks: number;
  }[];
  terrains?: { id: string; name: string; tiles: number[] }[];
};
export type SceneLayer = {
  mapId: string;
  enabled: boolean;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  main: boolean;
  sub: boolean;
  math: boolean;
  mosaic: number;
};
export type Instance = {
  id: string;
  actorId: string;
  animationId: string;
  variantId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipX: boolean;
};
export type Effect = {
  id: string;
  kind: "gradient" | "wave" | "iris";
  enabled: boolean;
  channel: number;
  layer: number;
  amplitude: number;
  period: number;
  speed: number;
  color: number;
  endColor: number;
  centerX: number;
  centerY: number;
  radius: number;
};
export type Scene = {
  id: string;
  name: string;
  mode: number;
  height: 224 | 239;
  interlace: boolean;
  bg3Priority: boolean;
  directColor: boolean;
  extbg: boolean;
  cameraX: number;
  cameraY: number;
  backdrop: number;
  fixedColor: number;
  math: "none" | "add" | "subtract";
  half: boolean;
  objMath: boolean;
  objSize: number;
  layers: SceneLayer[];
  instances: Instance[];
  effects: Effect[];
  angle: number;
  scale: number;
  perspective: number;
  horizon: number;
  offsetX: number[];
  offsetY: number[];
  paletteSlots?: { paletteId: string; layer: number; slot: number }[];
};
export type ExportSet = {
  id: string;
  name: string;
  sceneId: string;
  sheetIds: string[];
  actorIds: string[];
  mapIds: string[];
  paletteIds: string[];
  deduplicate: boolean;
  flips: boolean;
  reservedTiles: number;
};
export type Project = {
  format: "snes-graph";
  version: 1;
  id: string;
  name: string;
  fps: 50 | 60;
  palettes: Palette[];
  sheets: Sheet[];
  actors: Actor[];
  maps: Tilemap[];
  scenes: Scene[];
  exports: ExportSet[];
};
export const MODES: number[][] = [
  [2, 2, 2, 2],
  [4, 4, 2],
  [4, 4],
  [8, 4],
  [8, 2],
  [4, 2],
  [4],
  [8],
];
export const OBJ_SIZES = [
  [8, 16],
  [8, 32],
  [8, 64],
  [16, 32],
  [16, 64],
  [32, 64],
];
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export function flattenSheet(s: Sheet) {
  if (!s.layers) return;
  s.pixels = new Uint8Array(s.width * s.height);
  for (const l of s.layers)
    if (l.visible)
      for (let n = 0; n < l.pixels.length; n++)
        if (l.pixels[n]) s.pixels[n] = l.pixels[n];
}
export const rgb555 = (r: number, g: number, b: number) =>
  Math.round((r * 31) / 255) |
  (Math.round((g * 31) / 255) << 5) |
  (Math.round((b * 31) / 255) << 10);
export const rgb = (n: number): [number, number, number] =>
  [n & 31, (n >> 5) & 31, (n >> 10) & 31].map((v) =>
    Math.round((v * 255) / 31),
  ) as [number, number, number];
export const hex = (n: number) =>
  "#" +
  rgb(n)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export const fromHex = (v: string) =>
  rgb555(
    parseInt(v.slice(1, 3), 16),
    parseInt(v.slice(3, 5), 16),
    parseInt(v.slice(5, 7), 16),
  );
export const makePalette = (name = "Palette", size = 16): Palette => ({
  id: uid(),
  name,
  colors: Array.from({ length: size }, (_, i) =>
    rgb555(
      (i * 255) / (size - 1),
      (i * 255) / (size - 1),
      (i * 255) / (size - 1),
    ),
  ),
  labels: Array(size).fill(""),
  locked: Array(size).fill(false),
});
export const makeSheet = (
  paletteId: string,
  width = 32,
  height = 32,
  bpp: Bpp = 4,
  name = "Tiles",
): Sheet => ({
  id: uid(),
  name,
  width,
  height,
  bpp,
  paletteId,
  pixels: new Uint8Array(width * height),
});
export const makePose = (name = "Pose"): Pose => ({
  id: uid(),
  name,
  pieces: [],
  boxes: [],
  anchors: [],
});
export const makeActor = (name = "Sprite"): Actor => {
  const pose = makePose();
  return {
    id: uid(),
    name,
    originX: 0,
    originY: 0,
    poses: [pose],
    animations: [
      {
        id: uid(),
        name: "Idle",
        loop: true,
        pingPong: false,
        frames: [{ poseId: pose.id, ticks: 8, event: "" }],
      },
    ],
    variants: [],
  };
};
export const makeCell = (paletteId: string, tile = 0): Cell => ({
  tile,
  paletteId,
  flipX: false,
  flipY: false,
  priority: false,
  collision: 0,
});
export const makeMap = (sheet: Sheet, width = 32, height = 32): Tilemap => ({
  id: uid(),
  name: "Tilemap",
  sheetId: sheet.id,
  width,
  height,
  cells: Array.from({ length: width * height }, () =>
    makeCell(sheet.paletteId),
  ),
  stamps: [],
  animatedTiles: [],
});
export const makeScene = (): Scene => ({
  id: uid(),
  name: "Scene",
  mode: 1,
  height: 224,
  interlace: false,
  bg3Priority: false,
  directColor: false,
  extbg: false,
  cameraX: 0,
  cameraY: 0,
  backdrop: fromHex("#192330"),
  fixedColor: 0,
  math: "none",
  half: false,
  objMath: false,
  objSize: 0,
  layers: [],
  instances: [],
  effects: [],
  angle: 0,
  scale: 1,
  perspective: 0,
  horizon: 0,
  offsetX: [],
  offsetY: [],
});
export const makeLayer = (mapId: string): SceneLayer => ({
  mapId,
  enabled: true,
  x: 0,
  y: 0,
  speedX: 0,
  speedY: 0,
  main: true,
  sub: false,
  math: false,
  mosaic: 1,
});
export function newProject(): Project {
  const palette = makePalette();
  const sheet = makeSheet(palette.id);
  return {
    format: "snes-graph",
    version: 1,
    id: uid(),
    name: "Untitled",
    fps: 60,
    palettes: [palette],
    sheets: [sheet],
    actors: [],
    maps: [],
    scenes: [],
    exports: [],
  };
}
export function tileAt(map: Tilemap, tile: number, tick = 0): number {
  const animation = map.animatedTiles.find((a) => a.tile === tile);
  return animation?.frames.length
    ? animation.frames[
        Math.floor(tick / Math.max(animation.ticks, 1)) %
          animation.frames.length
      ]
    : tile;
}
/** Locate the source sequence entry, including its offset, during playback. */
export function animationPosition(
  a: Animation,
  tick: number,
  range: [number, number] | null = null,
) {
  const first = range
    ? Math.max(0, Math.min(range[0], a.frames.length - 1))
    : 0;
  const last = range
    ? Math.max(first, Math.min(range[1], a.frames.length - 1))
    : a.frames.length - 1;
  const indices = a.frames.map((_, i) => i).slice(first, last + 1);
  if (a.pingPong && indices.length > 2)
    indices.push(...indices.slice(1, -1).reverse());
  const total = indices.reduce((sum, i) => sum + a.frames[i].ticks, 0);
  let offset =
    a.loop || range
      ? Math.max(0, tick) % total
      : Math.min(Math.max(0, tick), total - 1);
  for (const index of indices) {
    if (offset < a.frames[index].ticks) return { index, offset };
    offset -= a.frames[index].ticks;
  }
  return { index: 0, offset: 0 };
}
export function frameAt(
  actor: Actor,
  animationId: string,
  tick: number,
  range: [number, number] | null = null,
): Pose | undefined {
  const a = actor.animations.find((a) => a.id === animationId);
  if (!a?.frames.length) return actor.poses[0];
  const { index } = animationPosition(a, tick, range);
  return actor.poses.find((p) => p.id === a.frames[index].poseId);
}
export function paletteAt(p: Palette, tick: number): number[] {
  const c = p.colors.slice(),
    a = p.cycle;
  if (!a) return c;
  const len = a.end - a.start + 1;
  const offset = Math.floor(tick / Math.max(a.ticks, 1)) % len;
  for (let i = 0; i < len; i++)
    c[a.start + i] = p.colors[a.start + ((i - offset + len) % len)];
  return c;
}
export function uses(p: Project, id: string): string[] {
  return [
    ...p.sheets.filter((s) => s.paletteId === id).map((s) => s.name),
    ...p.actors
      .filter(
        (a) =>
          a.poses.some((f) =>
            f.pieces.some((c) => c.sheetId === id || c.paletteId === id),
          ) ||
          a.variants.some((v) =>
            Object.entries(v.palettes).some(([a, b]) => a === id || b === id),
          ),
      )
      .map((a) => a.name),
    ...p.maps
      .filter(
        (m) =>
          m.sheetId === id ||
          m.cells.some((c) => c.paletteId === id) ||
          m.stamps.some((t) => t.cells.some((c) => c.paletteId === id)),
      )
      .map((m) => m.name),
    ...p.scenes
      .filter(
        (s) =>
          s.layers.some((l) => l.mapId === id) ||
          s.paletteSlots?.some((a) => a.paletteId === id) ||
          s.instances.some((i) => i.actorId === id),
      )
      .map((s) => s.name),
  ];
}
export function footballProject(): Project {
  const p = newProject();
  p.name = "Football";
  const home = p.palettes[0];
  home.name = "Domicile";
  home.colors = [
    "#000000",
    "#101828",
    "#1456c0",
    "#0a3070",
    "#ffffff",
    "#ffd6a3",
    "#b57647",
    "#26354f",
    "#8aa8d7",
    "#298e4d",
    "#13542c",
    "#e8e178",
    "#d8484d",
    "#751f35",
    "#80888f",
    "#b8c4cf",
  ].map(fromHex);
  home.labels = [
    "Transparent",
    "Contour",
    "Maillot",
    "Ombre maillot",
    "Détails",
    "Peau",
    "Ombre peau",
    "Cheveux",
    "Clair",
    "Herbe",
    "Herbe sombre",
    "Ligne",
    "Rouge",
    "Rouge sombre",
    "Gris",
    "Gris clair",
  ];
  const away = clone(home);
  away.id = uid();
  away.name = "Extérieur";
  away.colors[2] = fromHex("#f3f3ed");
  away.colors[3] = fromHex("#a8b8ce");
  away.colors[4] = fromHex("#dd3048");
  p.palettes.push(away);
  const s = makeSheet(home.id, 32, 48);
  s.name = "Joueur";
  const rect = (x: number, y: number, w: number, h: number, c: number) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) s.pixels[yy * 32 + xx] = c;
  };
  rect(11, 2, 10, 11, 1);
  rect(12, 4, 8, 8, 5);
  rect(11, 2, 10, 4, 7);
  rect(14, 8, 1, 1, 1);
  rect(18, 8, 1, 1, 1);
  rect(13, 12, 6, 3, 6);
  rect(8, 15, 16, 15, 1);
  rect(9, 16, 14, 13, 2);
  rect(9, 17, 3, 11, 3);
  rect(14, 16, 4, 2, 4);
  rect(4, 17, 5, 13, 5);
  rect(23, 17, 5, 13, 5);
  rect(4, 16, 5, 5, 2);
  rect(23, 16, 5, 5, 2);
  rect(9, 29, 14, 8, 7);
  rect(10, 36, 4, 7, 5);
  rect(18, 36, 4, 7, 5);
  rect(10, 40, 4, 4, 4);
  rect(18, 40, 4, 4, 4);
  rect(8, 44, 6, 3, 1);
  rect(18, 44, 6, 3, 1);
  p.sheets = [s];
  const a = makeActor("Joueur");
  a.originX = 16;
  a.originY = 47;
  for (let y = 0; y < 48; y += 16)
    for (let x = 0; x < 32; x += 16)
      a.poses[0].pieces.push({
        id: uid(),
        sheetId: s.id,
        sx: x,
        sy: y,
        size: 16,
        x,
        y,
        paletteId: home.id,
        flipX: false,
        flipY: false,
        priority: 2,
        group: "",
      });
  const step = clone(a.poses[0]);
  step.id = uid();
  step.name = "Pas";
  step.pieces.forEach((c) => {
    c.id = uid();
    if (c.y === 32) c.y -= 2;
  });
  a.poses.push(step);
  a.animations[0].name = "Marche";
  a.animations[0].frames.push({ poseId: step.id, ticks: 8, event: "step" });
  a.variants = [
    { id: uid(), name: "Domicile", palettes: {} },
    { id: uid(), name: "Extérieur", palettes: { [home.id]: away.id } },
  ];
  p.actors.push(a);
  const grass = makeSheet(home.id, 16, 8);
  grass.name = "Terrain";
  grass.pixels.fill(9);
  for (let y = 0; y < 8; y++) {
    grass.pixels[y * 16 + 8] = 11;
    for (let x = 0; x < 8; x++)
      if ((x + y) % 5 === 0) grass.pixels[y * 16 + x] = 10;
  }
  p.sheets.push(grass);
  const m = makeMap(grass);
  m.name = "Terrain";
  for (let y = 0; y < 32; y++) m.cells[y * 32 + 16].tile = 1;
  p.maps.push(m);
  const scene = makeScene();
  scene.name = "Match";
  scene.objSize = 3;
  scene.layers = [makeLayer(m.id)];
  scene.instances = [
    {
      id: uid(),
      actorId: a.id,
      animationId: a.animations[0].id,
      variantId: a.variants[0].id,
      x: 88,
      y: 130,
      vx: 0,
      vy: 0,
      flipX: false,
    },
    {
      id: uid(),
      actorId: a.id,
      animationId: a.animations[0].id,
      variantId: a.variants[1].id,
      x: 168,
      y: 130,
      vx: 0,
      vy: 0,
      flipX: true,
    },
  ];
  p.scenes.push(scene);
  return p;
}
