import { clone, type Actor, type Animation } from "./model";
export function moveFrames(a: Animation, selected: number[], before: number) {
  const ids = [...new Set(selected)]
    .filter((i) => i >= 0 && i < a.frames.length)
    .sort((a, b) => a - b);
  const moved = ids.map((i) => a.frames[i]),
    remaining = a.frames.filter((_, i) => !ids.includes(i));
  const index = Math.max(
    0,
    Math.min(remaining.length, before - ids.filter((i) => i < before).length),
  );
  remaining.splice(index, 0, ...moved);
  a.frames = remaining;
}
export function copyGroupPlacement(
  a: Actor,
  sourceId: string,
  group: string,
  targetIds: string[],
) {
  const source = a.poses
    .find((p) => p.id === sourceId)!
    .pieces.filter((c) => c.group === group);
  if (!group || !source.length)
    throw new Error("Choisissez un groupe nommé / Choose a named group");
  const targets = a.poses.filter(
    (p) => targetIds.includes(p.id) && p.id !== sourceId,
  );
  for (const p of targets)
    if (p.pieces.filter((c) => c.group === group).length !== source.length)
      throw new Error(
        `${p.name} : nombre de pièces différent / different piece count`,
      );
  for (const p of targets)
    p.pieces
      .filter((c) => c.group === group)
      .forEach((c, i) =>
        Object.assign(c, clone({ x: source[i].x, y: source[i].y })),
      );
}
