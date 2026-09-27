import { it, expect } from "vitest";
import { clone, footballProject } from "../src/core/model";
import { moveFrames, copyGroupPlacement } from "../src/core/animation-edit";
it("moves multiple sequence entries without altering their durations or events", () => {
  const a = footballProject().actors[0].animations[0];
  a.frames = Array.from({ length: 5 }, (_, i) => ({
    poseId: String(i),
    ticks: i + 1,
    event: `event-${i}`,
  }));
  const before = clone(a.frames);
  moveFrames(a, [1, 3], 5);
  expect(a.frames).toEqual([
    before[0],
    before[2],
    before[4],
    before[1],
    before[3],
  ]);
});
it("checks every target before copying group placement", () => {
  const a = footballProject().actors[0];
  a.poses[0].pieces.forEach((c) => (c.group = "body"));
  const matching = clone(a.poses[0]);
  matching.id = "matching";
  matching.pieces.forEach((c) => (c.x += 10));
  const bad = clone(matching);
  bad.id = "bad";
  bad.pieces.pop();
  a.poses.push(matching, bad);
  const before = clone(a);
  expect(() =>
    copyGroupPlacement(a, a.poses[0].id, "body", [matching.id, bad.id]),
  ).toThrow();
  expect(a).toEqual(before);
  copyGroupPlacement(a, a.poses[0].id, "body", [matching.id]);
  expect(matching.pieces.map((c) => c.x)).toEqual(
    a.poses[0].pieces.map((c) => c.x),
  );
});

it("keeps the playhead on the rendered source frame for ping-pong, ranges and non-looping playback", async () => {
  const { animationPosition, frameAt } = await import("../src/core/model");
  const actor = footballProject().actors[0];
  const pose = clone(actor.poses[0]);
  pose.id = "third";
  actor.poses.push(pose);
  const animation = actor.animations[0];
  animation.frames = actor.poses.map((p) => ({
    poseId: p.id,
    ticks: 8,
    event: "",
  }));
  animation.pingPong = true;
  expect(animationPosition(animation, 24)).toEqual({ index: 1, offset: 0 });
  expect(frameAt(actor, animation.id, 24)?.id).toBe(actor.poses[1].id);
  expect(animationPosition(animation, 27)).toEqual({ index: 1, offset: 3 });
  animation.loop = false;
  expect(animationPosition(animation, 100)).toEqual({ index: 1, offset: 7 });
  expect(frameAt(actor, animation.id, 100)?.id).toBe(actor.poses[1].id);
  expect(animationPosition(animation, 18, [1, 2])).toEqual({
    index: 1,
    offset: 2,
  });
  expect(frameAt(actor, animation.id, 18, [1, 2])?.id).toBe(actor.poses[1].id);
  // Undo can leave the UI range beyond the now shorter sequence.
  animation.frames.pop();
  expect(animationPosition(animation, 18, [2, 2])).toEqual({
    index: 1,
    offset: 2,
  });
  expect(frameAt(actor, animation.id, 18, [2, 2])?.id).toBe(actor.poses[1].id);
});
