import assert from "node:assert/strict";
import test from "node:test";
import { createParticleGeometry } from "../src/components/renderer/particleGeometry.ts";

const base = {
  version: 1,
  seed: 123456,
  name: "test",
  tagline: "test",
  geometry: { mode: "sphere", count: 6000, radius: 1.5, dispersion: 0.4, irregularity: 0.5, bands: 3 },
  motion: { rotationSpeed: 0.1, pulse: 0.2, drift: 0.2, interaction: 0.5, burst: 2 },
  palette: { inner: "#ffffff", outer: "#7766ff", accent: "#22aaff", background: "#080615" },
  orbit: { count: 2, radius: 2, tilt: 0.4, opacity: 0.5 },
  creative: { displacement: null },
};

test("same spec and seed reproduce identical particle buffers", () => {
  const first = createParticleGeometry(base);
  const second = createParticleGeometry(base);
  try {
    for (const attribute of ["position", "color", "aBurst", "aSize", "aSeed", "aOpacity"]) {
      assert.deepEqual(first.getAttribute(attribute).array, second.getAttribute(attribute).array);
    }
    assert.equal(first.getAttribute("position").count, base.geometry.count);
  } finally {
    first.dispose();
    second.dispose();
  }
});

test("geometry mode and seed materially change particle placement", () => {
  const sphere = createParticleGeometry(base);
  const nebula = createParticleGeometry({ ...base, geometry: { ...base.geometry, mode: "nebula" } });
  const otherSeed = createParticleGeometry({ ...base, seed: base.seed + 1 });
  try {
    assert.notDeepEqual(sphere.getAttribute("position").array, nebula.getAttribute("position").array);
    assert.notDeepEqual(sphere.getAttribute("position").array, otherSeed.getAttribute("position").array);
  } finally {
    sphere.dispose();
    nebula.dispose();
    otherSeed.dispose();
  }
});
