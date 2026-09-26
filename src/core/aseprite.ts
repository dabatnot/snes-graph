import { unzlibSync } from "fflate";
import { encode } from "fast-png";
import { importPng } from "./import";
import { makeActor, makePose, uid, type Palette } from "./model";

/** Normal raster layers, linked cels and named tags. Unsupported compositing is rejected explicitly. */
export function importAseprite(
  bytes: Uint8Array,
  name: string,
  fps: number,
  target?: Palette,
  dither = false,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (n: number) => view.getUint16(n, true),
    i16 = (n: number) => view.getInt16(n, true),
    u32 = (n: number) => view.getUint32(n, true);
  const string = (n: number) =>
    new TextDecoder().decode(bytes.slice(n + 2, n + 2 + u16(n)));
  if (bytes.length < 128 || u16(4) !== 0xa5e0 || u32(0) !== bytes.length)
    throw new Error("Invalid Aseprite file");
  const count = u16(6),
    width = u16(8),
    height = u16(10),
    depth = u16(12),
    transparent = bytes[28];
  if (
    !count ||
    count > 1024 ||
    !width ||
    !height ||
    width > 512 ||
    height > 512 ||
    ![8, 16, 32].includes(depth)
  )
    throw new Error("Unsupported Aseprite dimensions/depth");
  const frameWidth = Math.ceil(width / 8) * 8,
    frameHeight = Math.ceil(height / 8) * 8,
    columns = Math.min(count, Math.floor(4096 / frameWidth)),
    rows = Math.ceil(count / columns),
    atlasWidth = columns * frameWidth,
    atlasHeight = rows * frameHeight;
  if (atlasHeight > 4096 || atlasWidth * atlasHeight > 8 * 1024 * 1024)
    throw new Error("Aseprite sheet exceeds 8 million pixels");
  const atlas = new Uint8Array(atlasWidth * atlasHeight * 4),
    durations: number[] = [],
    tags: { from: number; to: number; direction: number; name: string }[] = [];
  const layers: { visible: boolean; opacity: number; background: boolean }[] =
      [],
    palette: number[][] = Array.from({ length: 256 }, () => [0, 0, 0, 255]);
  type Cel = {
    layer: number;
    x: number;
    y: number;
    opacity: number;
    width: number;
    height: number;
    data: Uint8Array;
  };
  const frames: Cel[][] = [];
  let position = 128;
  for (let frame = 0; frame < count; frame++) {
    if (position + 16 > bytes.length || u16(position + 4) !== 0xf1fa)
      throw new Error("Invalid Aseprite frame");
    const end = position + u32(position),
      chunks = u32(position + 12) || u16(position + 6);
    durations.push(u16(position + 8) || 100);
    position += 16;
    const cels: Cel[] = [];
    for (let chunk = 0; chunk < chunks; chunk++) {
      if (position + 6 > end) throw new Error("Invalid Aseprite chunk");
      const size = u32(position),
        type = u16(position + 4),
        at = position + 6,
        next = position + size;
      if (size < 6 || next > end || next > bytes.length)
        throw new Error("Truncated Aseprite chunk");
      if (type === 0x2004) {
        if (u16(at + 2) !== 0 || u16(at + 4) !== 0 || u16(at + 10) !== 0)
          throw new Error(
            "Flatten Aseprite groups, tilemap layers and blend modes before import / Aplatissez les groupes et modes de fusion.",
          );
        layers.push({
          visible: !!(u16(at) & 1),
          background: !!(u16(at) & 8),
          opacity: bytes[at + 12],
        });
      } else if (type === 0x2019) {
        const first = u32(at + 4),
          last = u32(at + 8);
        if (last > 255 || last < first)
          throw new Error("Aseprite palette exceeds 256 colors");
        let q = at + 20;
        for (let n = first; n <= last; n++) {
          const flags = u16(q);
          palette[n] = Array.from(bytes.slice(q + 2, q + 6));
          q += 6;
          if (flags & 1) q += 2 + u16(q);
          if (q > next) throw new Error("Truncated palette");
        }
      } else if (type === 0x0004 || type === 0x0011) {
        let q = at + 2,
          index = 0;
        for (let packet = 0; packet < u16(at); packet++) {
          index += bytes[q++];
          const length = bytes[q++] || 256;
          for (let n = 0; n < length; n++) {
            if (index >= 256) throw new Error("Invalid palette");
            const factor = type === 0x0011 ? 255 / 63 : 1;
            palette[index++] = [
              Math.round(bytes[q++] * factor),
              Math.round(bytes[q++] * factor),
              Math.round(bytes[q++] * factor),
              255,
            ];
          }
        }
      } else if (type === 0x2018) {
        let q = at + 10;
        for (let n = 0; n < u16(at); n++) {
          tags.push({
            from: u16(q),
            to: u16(q + 2),
            direction: bytes[q + 4],
            name: string(q + 17),
          });
          q += 19 + u16(q + 17);
          if (q > next) throw new Error("Truncated animation tags");
        }
      } else if (type === 0x2005) {
        const layer = u16(at),
          kind = u16(at + 7);
        if (i16(at + 9) !== 0)
          throw new Error("Flatten cel Z-order before import");
        const cel: Cel = {
          layer,
          x: i16(at + 2),
          y: i16(at + 4),
          opacity: bytes[at + 6],
          width: 0,
          height: 0,
          data: new Uint8Array(),
        };
        if (kind === 1) {
          const linked = frames[u16(at + 16)]?.find((c) => c.layer === layer);
          if (!linked) throw new Error("Missing linked cel");
          Object.assign(cel, {
            width: linked.width,
            height: linked.height,
            data: linked.data,
          });
        } else if (kind === 0 || kind === 2) {
          cel.width = u16(at + 16);
          cel.height = u16(at + 18);
          const length = cel.width * cel.height * (depth / 8);
          if (length > 64 * 1024 * 1024) throw new Error("Cel too large");
          cel.data =
            kind === 2
              ? unzlibSync(bytes.slice(at + 20, next), {
                  out: new Uint8Array(length),
                })
              : bytes.slice(at + 20, next);
          if (cel.data.length !== length) throw new Error("Invalid cel pixels");
        } else
          throw new Error("Rasterize Aseprite tilemap layers before import");
        cels.push(cel);
      }
      position = next;
    }
    position = end;
    frames.push(cels);
    const rendered = new Uint8Array(width * height * 4);
    for (const cel of cels.sort((a, b) => a.layer - b.layer)) {
      const layer = layers[cel.layer];
      if (!layer?.visible) continue;
      for (let y = 0; y < cel.height; y++)
        for (let x = 0; x < cel.width; x++) {
          const px = cel.x + x,
            py = cel.y + y;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const n = (y * cel.width + x) * (depth / 8),
            index = cel.data[n],
            color =
              depth === 8
                ? [...palette[index]]
                : depth === 16
                  ? [index, index, index, cel.data[n + 1]]
                  : Array.from(cel.data.slice(n, n + 4));
          if (depth === 8 && !layer.background && index === transparent)
            color[3] = 0;
          const a =
              ((((color[3] / 255) * cel.opacity) / 255) * layer.opacity) / 255,
            k = (py * width + px) * 4,
            old = rendered[k + 3] / 255,
            total = a + old * (1 - a);
          if (!total) continue;
          for (let c = 0; c < 3; c++)
            rendered[k + c] = Math.round(
              (color[c] * a + rendered[k + c] * old * (1 - a)) / total,
            );
          rendered[k + 3] = Math.round(total * 255);
        }
    }
    const ox = (frame % columns) * frameWidth,
      oy = Math.floor(frame / columns) * frameHeight;
    for (let y = 0; y < height; y++)
      atlas.set(
        rendered.subarray(y * width * 4, (y + 1) * width * 4),
        ((oy + y) * atlasWidth + ox) * 4,
      );
  }
  const imported = importPng(
      encode({
        width: atlasWidth,
        height: atlasHeight,
        data: atlas,
        channels: 4,
        depth: 8,
      }),
      name,
      target,
      dither,
    ),
    actor = makeActor(name);
  actor.poses = [];
  actor.originX = Math.floor(width / 2);
  actor.originY = height - 1;
  for (let frame = 0; frame < count; frame++) {
    const pose = makePose(String(frame + 1)),
      ox = (frame % columns) * frameWidth,
      oy = Math.floor(frame / columns) * frameHeight,
      size = frameWidth % 16 === 0 && frameHeight % 16 === 0 ? 16 : 8;
    for (let y = 0; y < frameHeight; y += size)
      for (let x = 0; x < frameWidth; x += size) {
        let visible = false;
        for (let yy = 0; yy < size; yy++)
          for (let xx = 0; xx < size; xx++)
            if (imported.sheet.pixels[(oy + y + yy) * atlasWidth + ox + x + xx])
              visible = true;
        if (visible)
          pose.pieces.push({
            id: uid(),
            sheetId: imported.sheet.id,
            sx: ox + x,
            sy: oy + y,
            size,
            x,
            y,
            paletteId: imported.palette.id,
            flipX: false,
            flipY: false,
            priority: 2,
            group: "",
          });
      }
    actor.poses.push(pose);
  }
  if (imported.sheet.bpp !== 4)
    throw new Error("Aseprite characters require a 16-entry palette");
  actor.animations = (
    tags.length
      ? tags
      : [{ from: 0, to: count - 1, direction: 0, name: "Animation" }]
  ).map((tag) => {
    if (tag.from > tag.to || tag.to >= count)
      throw new Error("Invalid Aseprite tag range");
    const indices = Array.from(
      { length: tag.to - tag.from + 1 },
      (_, i) => i + tag.from,
    );
    if (tag.direction === 1 || tag.direction === 3) indices.reverse();
    return {
      id: uid(),
      name: tag.name,
      loop: true,
      pingPong: tag.direction >= 2,
      frames: indices.map((i) => ({
        poseId: actor.poses[i].id,
        ticks: Math.max(1, Math.round((durations[i] * fps) / 1000)),
        event: "",
      })),
    };
  });
  return { ...imported, actor };
}
