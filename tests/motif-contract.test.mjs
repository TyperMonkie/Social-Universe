import assert from "node:assert/strict";
import test from "node:test";
import { defaultSpec } from "../src/lib/default-spec.ts";
import {
  motifSchema,
  motifsSchema,
  renderSpecSchema,
  retainValidMotifs,
  fitGeneratedMotifs,
} from "../src/lib/contracts.ts";

const motif = {
  label: "潮汐的手写线",
  strokes: [
    {
      points: [[1.1, -0.4, 0], [1.45, 0.1, 0.2], [1.2, 0.5, 0.4]],
      closed: false,
      primitive: "tube",
    },
  ],
  copies: 2,
  axis: "y",
  color: "#63b6ed",
  width: 0.012,
  opacity: 0.4,
  motion: { spin: 0.04, breathe: 0.03, shimmer: 0.6, phase: 1.3 },
};

test("legacy v1 RenderSpec remains importable and v2 requires a motifs array", () => {
  assert.equal(renderSpecSchema.safeParse(defaultSpec).success, true);
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2 }).success, false);
  const v2 = { ...defaultSpec, version: 2, motifs: [motif] };
  assert.equal(renderSpecSchema.safeParse(v2).success, true);
  assert.equal(renderSpecSchema.safeParse({ ...v2, motifs: [] }).success, true);
});

test("invalid motif is dropped while the other model-drawn motifs survive", () => {
  const second = { ...motif, label: "枝状星图", color: "#f7c88a" };
  const invalid = { ...motif, label: "bad", strokes: [{ ...motif.strokes[0], points: [[3, 3, 3], [1.1, 0, 0]] }] };
  assert.equal(motifSchema.safeParse(invalid).success, false);
  const retained = retainValidMotifs([motif, invalid, second]);
  assert.deepEqual(retained.map((item) => item.label), [motif.label, second.label]);
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: retained }).success, true);
  assert.deepEqual(retainValidMotifs([invalid]), []);
});

test("tuple shape, unknown instructions and degenerate paths are rejected", () => {
  const wrongTuple = { ...motif, strokes: [{ ...motif.strokes[0], points: [[1.1, 0], [1.2, 0, 0]] }] };
  const extraInstruction = { ...motif, javascript: "alert(1)" };
  const degenerate = { ...motif, strokes: [{ ...motif.strokes[0], points: [[1.1, 0, 0], [1.1, 0, 0]] }] };
  assert.equal(motifSchema.safeParse(wrongTuple).success, false);
  assert.equal(motifSchema.safeParse(extraInstruction).success, false);
  assert.equal(motifSchema.safeParse(degenerate).success, false);
});

test("combined motif complexity stays within one shared rendering budget", () => {
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI * 2 / 12;
    return [Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0];
  });
  const heavy = {
    ...motif,
    strokes: Array.from({ length: 4 }, () => ({ points, closed: true, primitive: "beads" })),
    copies: 6,
  };
  assert.equal(motifSchema.safeParse(heavy).success, true);
  assert.equal(motifsSchema.safeParse([heavy, { ...heavy, label: "second" }]).success, false);
  assert.deepEqual(retainValidMotifs([heavy, { ...heavy, label: "second" }]).map((item) => item.label), [heavy.label]);
});

test("model-drawn contours are scaled into the readable shell without changing their shape", () => {
  const wide = {
    ...motif,
    strokes: [{
      points: [[1.1, 0, 0], [2, 0.2, 0], [1.5, 0.5, 0]],
      closed: false,
      primitive: "tube",
    }],
  };
  const [fitted] = fitGeneratedMotifs([wide]);
  assert.equal(motifSchema.safeParse(fitted).success, true);
  const maximum = Math.max(...fitted.strokes.flatMap((stroke) => stroke.points.map((point) => Math.hypot(...point))));
  assert.ok(Math.abs(maximum - 1.7) < 1e-9);
  const originalRatio = wide.strokes[0].points[0][0] / wide.strokes[0].points[1][0];
  const fittedRatio = fitted.strokes[0].points[0][0] / fitted.strokes[0].points[1][0];
  assert.ok(Math.abs(originalRatio - fittedRatio) < 1e-9);
  assert.deepEqual(fitGeneratedMotifs([motif]), [motif]);
});
