import type { RenderSpec } from "./contracts";

export const defaultSpec: RenderSpec = {
  version: 1,
  seed: 274196,
  name: "Vesper Bloom",
  tagline: "A universe waiting for a story",
  geometry: {
    mode: "hybrid",
    count: 32000,
    radius: 1.55,
    dispersion: 0.38,
    irregularity: 0.42,
    bands: 3,
  },
  motion: {
    rotationSpeed: 0.075,
    pulse: 0.23,
    drift: 0.3,
    interaction: 0.65,
    burst: 2.8,
  },
  palette: {
    inner: "#f6b8ff",
    outer: "#745df4",
    accent: "#7de8ff",
    background: "#080615",
  },
  orbit: { count: 2, radius: 2.18, tilt: 0.38, opacity: 0.58 },
  creative: { displacement: null },
};
