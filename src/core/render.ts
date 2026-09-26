import {
  MODES,
  frameAt,
  paletteAt,
  rgb,
  type Project,
  type Sheet,
  type Actor,
  type Pose,
  type Scene,
  type Variant,
} from "./model";
import { pixel } from "./pixels";
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
const mod = (v: number, m: number) => ((v % m) + m) % m;
export function raster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
function plot(out: Raster, x: number, y: number, color: number, alpha = 255) {
  if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
  const n = (y * out.width + x) * 4,
    c = rgb(color);
  out.data.set([...c, alpha], n);
}
export function renderSheet(
  p: Project,
  s: Sheet,
  paletteId = s.paletteId,
  tick = 0,
): Raster {
  const out = raster(s.width, s.height),
    pal = p.palettes.find((a) => a.id === paletteId);
  if (!pal) return out;
  const colors = paletteAt(pal, tick);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const v = pixel(s, x, y);
      if (v) plot(out, x, y, colors[v] ?? 0);
    }
  return out;
}
export function renderActor(
  p: Project,
  a: Actor,
  pose: Pose | undefined,
  variant?: Variant,
  tick = 0,
): Raster {
  const out = raster(128, 128);
  if (!pose) return out;
  for (const c of [...pose.pieces].reverse()) {
    const s = p.sheets.find((s) => s.id === c.sheetId),
      pal = p.palettes.find(
        (p) => p.id === (variant?.palettes[c.paletteId] ?? c.paletteId),
      );
    if (!s || !pal) continue;
    const colors = paletteAt(pal, tick);
    for (let y = 0; y < c.size; y++)
      for (let x = 0; x < c.size; x++) {
        const v = pixel(
          s,
          c.sx + (c.flipX ? c.size - x - 1 : x),
          c.sy + (c.flipY ? c.size - y - 1 : y),
        );
        if (v)
          plot(
            out,
            64 - a.originX + c.x + x,
            80 - a.originY + c.y + y,
            colors[v] ?? 0,
          );
      }
  }
  return out;
}
export function renderMap(p: Project, mapId: string, tick = 0): Raster {
  const m = p.maps.find((m) => m.id === mapId)!;
  const s = p.sheets.find((s) => s.id === m.sheetId)!;
  const out = raster(m.width * 8, m.height * 8);
  const pals = new Map(p.palettes.map((a) => [a.id, paletteAt(a, tick)]));
  for (let cy = 0; cy < m.height; cy++)
    for (let cx = 0; cx < m.width; cx++) {
      const c = m.cells[cy * m.width + cx],
        colors = pals.get(c.paletteId);
      if (!colors) continue;
      const anim = m.animatedTiles.find((t) => t.tile === c.tile);
      const tile = anim?.frames.length
        ? anim.frames[
            Math.floor(tick / Math.max(anim.ticks, 1)) % anim.frames.length
          ]
        : c.tile;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = pixel(
            s,
            (tile % (s.width / 8)) * 8 + (c.flipX ? 7 - x : x),
            Math.floor(tile / (s.width / 8)) * 8 + (c.flipY ? 7 - y : y),
          );
          if (v) plot(out, cx * 8 + x, cy * 8 + y, colors[v] ?? 0);
        }
    }
  return out;
}
function priority(mode: number, bg: number, high: boolean, bg3: boolean) {
  if (mode === 0)
    return (
      [
        [8, 11],
        [7, 10],
        [2, 5],
        [1, 4],
      ][bg]?.[+high] ?? -1
    );
  if (mode === 1)
    return (
      (bg3
        ? [
            [5, 8],
            [4, 7],
            [1, 10],
          ]
        : [
            [6, 9],
            [5, 8],
            [1, 3],
          ])[bg]?.[+high] ?? -1
    );
  if (mode === 6) return high ? 5 : 2;
  if (mode === 7) return bg === 0 ? 2 : high ? 5 : 1;
  return (
    [
      [3, 7],
      [1, 5],
    ][bg]?.[+high] ?? -1
  );
}
export function renderScene(p: Project, s: Scene, tick = 0): Raster {
  const hi = s.mode === 5 || s.mode === 6,
    w = hi ? 512 : 256,
    h = s.height * (s.interlace ? 2 : 1),
    out = raster(w, h),
    len = w * h,
    main = new Uint16Array(len),
    sub = new Uint16Array(len),
    mz = new Int8Array(len).fill(-1),
    sz = new Int8Array(len).fill(-1),
    math = new Uint8Array(len),
    pals = new Map(p.palettes.map((a) => [a.id, paletteAt(a, tick)]));
  main.fill(s.backdrop);
  sub.fill(s.fixedColor);
  const enabled = s.effects.filter((e) => e.enabled);
  const gradient = enabled.find((e) => e.kind === "gradient"),
    iris = enabled.find((e) => e.kind === "iris");
  for (let y = 0; y < h; y++) {
    if (gradient) {
      let c = 0;
      const t = y / Math.max(h - 1, 1);
      for (let b = 0; b < 3; b++) {
        const a = (gradient.color >> (b * 5)) & 31,
          z = (gradient.endColor >> (b * 5)) & 31;
        c |= Math.round(a + (z - a) * t) << (b * 5);
      }
      main.fill(c, y * w, (y + 1) * w);
    }
  }
  for (let li = 0; li < s.layers.length; li++) {
    const l = s.layers[li];
    if (!l.enabled || !MODES[s.mode][li]) continue;
    const m = p.maps.find((m) => m.id === l.mapId),
      sh = p.sheets.find((sh) => sh.id === m?.sheetId);
    if (!m || !sh) continue;
    const wave = enabled.find((e) => e.kind === "wave" && e.layer === li),
      tileW = hi ? 16 : 8;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const logicalY = y / (s.interlace ? 2 : 1),
          logicalX = x / (hi ? 2 : 1);
        if (
          iris &&
          (logicalX - iris.centerX) ** 2 + (logicalY - iris.centerY) ** 2 >
            iris.radius ** 2
        )
          continue;
        let px =
            Math.floor(x / Math.max(l.mosaic, 1)) * Math.max(l.mosaic, 1) +
            (s.cameraX + l.x + (l.speedX * tick) / p.fps) * (hi ? 2 : 1),
          py =
            Math.floor(y / Math.max(l.mosaic, 1)) * Math.max(l.mosaic, 1) +
            s.cameraY +
            l.y +
            (l.speedY * tick) / p.fps;
        if (wave)
          px += Math.round(
            Math.sin(
              (logicalY * Math.PI * 2) / Math.max(wave.period, 1) +
                (tick * wave.speed) / p.fps,
            ) * wave.amplitude,
          );
        if ([2, 4, 6].includes(s.mode) && li === 0) {
          const col = Math.floor(logicalX / 8) - 1;
          if (col >= 0) {
            px += Math.floor((s.offsetX[col] ?? 0) / 8) * 8 * (hi ? 2 : 1);
            py += s.offsetY[col] ?? 0;
          }
        }
        if (s.mode === 7) {
          const scale =
            s.scale * (1 + s.perspective / Math.max(1, logicalY - s.horizon));
          const dx = (logicalX - 128) * scale,
            dy = (logicalY - h / 2) * scale;
          const rad = (s.angle * Math.PI) / 180;
          px = Math.floor(
            dx * Math.cos(rad) - dy * Math.sin(rad) + s.cameraX + 512,
          );
          py = Math.floor(
            dx * Math.sin(rad) + dy * Math.cos(rad) + s.cameraY + 512,
          );
        }
        px = mod(Math.floor(px), m.width * tileW);
        py = mod(Math.floor(py), m.height * 8);
        const c =
          m.cells[Math.floor(py / 8) * m.width + Math.floor(px / tileW)];
        if (!c) continue;
        const anim = m.animatedTiles.find((a) => a.tile === c.tile);
        let tile = anim?.frames.length
          ? anim.frames[
              Math.floor(tick / Math.max(anim.ticks, 1)) % anim.frames.length
            ]
          : c.tile;
        let tx = px % tileW,
          ty = py % 8;
        if (c.flipX && s.mode !== 7) tx = tileW - 1 - tx;
        if (c.flipY && s.mode !== 7) ty = 7 - ty;
        tile += Math.floor(tx / 8);
        const v = pixel(
          sh,
          (tile % (sh.width / 8)) * 8 + (tx % 8),
          Math.floor(tile / (sh.width / 8)) * 8 + ty,
        );
        if (!v) continue;
        let col = pals.get(c.paletteId)?.[v] ?? 0;
        if (s.directColor && li === 0 && [3, 4, 7].includes(s.mode)) {
          const bits = s.mode === 7 ? 0 : (c.directColor ?? 0);
          col =
            ((v & 7) << 2) |
            ((bits & 1) << 1) |
            (((v >> 3) & 7) << 7) |
            ((bits & 2) << 5) |
            (((v >> 6) & 3) << 13) |
            ((bits & 4) << 10);
        }
        const n = y * w + x;
        let z = priority(s.mode, li, c.priority, s.bg3Priority);
        if (s.mode === 7 && s.extbg) {
          z = 3;
          if (v & 128 && v & 127) {
            z = 5;
            col = pals.get(c.paletteId)?.[v & 127] ?? 0;
          }
        }
        if (l.main && z > mz[n]) {
          main[n] = col;
          mz[n] = z;
          math[n] = +l.math;
        }
        if (l.sub && z > sz[n]) {
          sub[n] = col;
          sz[n] = z;
        }
      }
  }
  const objSet = new Uint8Array(len),
    lineCount = new Uint16Array(h);
  let objCount = 0;
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId)!;
    const pose = frameAt(a, i.animationId, tick),
      variant = a.variants.find((v) => v.id === i.variantId);
    if (!pose) continue;
    for (const c of pose.pieces) {
      if (objCount++ >= 128) break;
      const sh = p.sheets.find((sh) => sh.id === c.sheetId)!,
        colors = pals.get(variant?.palettes[c.paletteId] ?? c.paletteId);
      if (!colors) continue;
      const ox = Math.round(
          i.x +
            (i.vx * tick) / p.fps -
            a.originX +
            (i.flipX ? 2 * a.originX - c.x - c.size : c.x),
        ),
        oy = Math.round(i.y + (i.vy * tick) / p.fps - a.originY + c.y);
      for (let y = 0; y < c.size; y++) {
        const yy = oy + y;
        if (yy < 0 || yy >= s.height) continue;
        if (ox <= -c.size || ox >= 256) continue;
        if (++lineCount[yy] > 32) continue;
        for (let x = 0; x < c.size; x++) {
          const xx = ox + x;
          if (xx < 0 || xx >= 256) continue;
          if (
            iris &&
            (xx - iris.centerX) ** 2 + (yy - iris.centerY) ** 2 >
              iris.radius ** 2
          )
            continue;
          const v = pixel(
            sh,
            c.sx + (c.flipX !== i.flipX ? c.size - x - 1 : x),
            c.sy + (c.flipY ? c.size - y - 1 : y),
          );
          if (!v) continue;
          for (let dy = 0; dy < (s.interlace ? 2 : 1); dy++)
            for (let dx = 0; dx < (hi ? 2 : 1); dx++) {
              const n =
                (yy * (s.interlace ? 2 : 1) + dy) * w + xx * (hi ? 2 : 1) + dx;
              if (objSet[n]) continue;
              objSet[n] = 1;
              const ranks =
                s.mode === 0
                  ? [3, 6, 9, 12]
                  : s.mode === 1
                    ? s.bg3Priority
                      ? [2, 3, 6, 9]
                      : [2, 4, 7, 10]
                    : s.mode === 6
                      ? [1, 3, 4, 6]
                      : s.mode === 7
                        ? s.extbg
                          ? [2, 4, 6, 7]
                          : [1, 3, 4, 5]
                        : [2, 4, 6, 8];
              const z = ranks[c.priority];
              if (z > mz[n]) {
                main[n] = colors[v] ?? 0;
                mz[n] = z;
                math[n] = +s.objMath;
              }
            }
        }
      }
    }
  }
  for (let n = 0; n < len; n++) {
    let c = main[n];
    if (s.math !== "none" && math[n]) {
      c = 0;
      for (let b = 0; b < 3; b++) {
        let v =
          ((main[n] >> (b * 5)) & 31) +
          (s.math === "subtract" ? -1 : 1) * ((sub[n] >> (b * 5)) & 31);
        v = Math.max(0, Math.min(31, s.half ? Math.floor(v / 2) : v));
        c |= v << (b * 5);
      }
    }
    const color = rgb(c);
    out.data.set([...color, 255], n * 4);
  }
  return out;
}
