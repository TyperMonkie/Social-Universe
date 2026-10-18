import { BufferAttribute, BufferGeometry } from "three";
import type { RenderSpec } from "@/lib/contracts";

type Vec3 = [number, number, number];

function randomFromSeed(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function colorFromHex(hex: string): Vec3 {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function mixColor(a: Vec3, b: Vec3, amount: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function sphereDirection(random: () => number): Vec3 {
  const y = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
  return [horizontal * Math.cos(angle), y, horizontal * Math.sin(angle)];
}

/** Build a reproducible, intentionally layered point cloud. No per-frame CPU updates. */
export function createParticleGeometry(spec: RenderSpec): BufferGeometry {
  const random = randomFromSeed(spec.seed);
  const count = spec.geometry.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const burstVectors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const opacities = new Float32Array(count);
  const inner = colorFromHex(spec.palette.inner);
  const outer = colorFromHex(spec.palette.outer);
  const accent = colorFromHex(spec.palette.accent);
  const { radius, irregularity, dispersion, bands, mode } = spec.geometry;

  for (let index = 0; index < count; index++) {
    const placement = random();
    const direction = sphereDirection(random);
    const angle = Math.atan2(direction[2], direction[0]);
    const latitude = Math.asin(direction[1]);
    const ridge =
      0.58 * Math.sin(angle * 5 + latitude * 8 + spec.seed * 0.001) +
      0.27 * Math.sin(angle * 11 - latitude * 5 + 1.7) +
      0.15 * Math.cos(angle * 19 + latitude * 14);
    let point: Vec3;
    let layer = 0;

    if (mode === "sphere") {
      if (placement < 0.78) {
        const shell = radius * (0.97 + ridge * 0.14 * irregularity + (random() - 0.5) * 0.09);
        point = [direction[0] * shell, direction[1] * shell, direction[2] * shell];
      } else if (placement < 0.91) {
        layer = 1;
        const haze = radius * (1.07 + random() * (0.35 + dispersion * 0.5));
        point = [direction[0] * haze, direction[1] * haze, direction[2] * haze];
      } else {
        layer = 2;
        const core = radius * Math.cbrt(random()) * 0.86;
        point = [direction[0] * core, direction[1] * core, direction[2] * core];
      }
    } else if (mode === "hybrid") {
      if (placement < 0.53) {
        const shell = radius * (0.91 + ridge * 0.23 * irregularity + (random() - 0.5) * 0.12);
        point = [direction[0] * shell, direction[1] * shell, direction[2] * shell];
      } else if (placement < 0.86) {
        layer = 1;
        const armCount = Math.max(2, bands || 3);
        const arm = Math.floor(random() * armCount);
        const along = random();
        const theta = arm * Math.PI * 2 / armCount + along * Math.PI * 1.8 + (random() - 0.5) * 0.3;
        const reach = radius * (0.94 + along * (0.35 + dispersion * 0.85) + (random() - 0.5) * 0.15);
        const height = (random() - 0.5) * radius * 0.29 + Math.sin(theta * 2.2) * radius * 0.17;
        point = [Math.cos(theta) * reach, height, Math.sin(theta) * reach * 0.72];
      } else {
        layer = 2;
        const reach = radius * (1.2 + Math.pow(random(), 1.8) * (0.35 + dispersion));
        point = [direction[0] * reach, direction[1] * reach, direction[2] * reach];
      }
    } else {
      if (placement < 0.25) {
        layer = 2;
        const core = radius * Math.cbrt(random()) * 0.85;
        point = [direction[0] * core, direction[1] * core * 0.72, direction[2] * core];
      } else if (placement < 0.86) {
        layer = 1;
        const armCount = Math.max(2, bands || 3);
        const arm = Math.floor(random() * armCount);
        const along = Math.pow(random(), 0.7);
        const theta = arm * Math.PI * 2 / armCount + along * Math.PI * 2.45 + (random() - 0.5) * (0.55 + dispersion);
        const reach = radius * (0.3 + along * (1.18 + dispersion * 0.85));
        const thickness = radius * (0.06 + along * 0.18);
        point = [
          Math.cos(theta) * reach + (random() - 0.5) * thickness,
          Math.sin(theta * 1.6) * radius * 0.13 + (random() - 0.5) * thickness * 1.8,
          Math.sin(theta) * reach * 0.76 + (random() - 0.5) * thickness,
        ];
      } else {
        layer = 3;
        const spread = radius * (1.4 + random() * (0.6 + dispersion));
        point = [direction[0] * spread, direction[1] * spread * 0.65, direction[2] * spread];
      }
    }

    const offset = index * 3;
    positions[offset] = point[0];
    positions[offset + 1] = point[1];
    positions[offset + 2] = point[2];

    const mix = layer === 2 ? random() * 0.42 : layer === 1 ? 0.35 + random() * 0.65 : random() * 0.82;
    let color = mixColor(inner, outer, mix);
    if (random() < (layer === 1 ? 0.23 : 0.065)) color = mixColor(color, accent, 0.55 + random() * 0.45);
    const brightness = layer === 3 ? 0.52 : 0.69 + random() * 0.5;
    colors[offset] = Math.min(1, color[0] * brightness);
    colors[offset + 1] = Math.min(1, color[1] * brightness);
    colors[offset + 2] = Math.min(1, color[2] * brightness);

    const length = Math.hypot(point[0], point[1], point[2]) || 1;
    const sideways = sphereDirection(random);
    const burstLength = 0.5 + Math.pow(random(), 0.7) * 0.95;
    burstVectors[offset] = point[0] / length * burstLength + sideways[0] * 0.21;
    burstVectors[offset + 1] = point[1] / length * burstLength + sideways[1] * 0.21;
    burstVectors[offset + 2] = point[2] / length * burstLength + sideways[2] * 0.21;
    sizes[index] = (layer === 3 ? 1.1 : 1.5) + Math.pow(random(), 3.2) * (layer === 1 ? 4.8 : 3.6);
    seeds[index] = random();
    opacities[index] = (layer === 3 ? 0.23 : layer === 1 ? 0.48 : 0.61) + random() * (layer === 3 ? 0.2 : 0.31);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("aBurst", new BufferAttribute(burstVectors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geometry.setAttribute("aOpacity", new BufferAttribute(opacities, 1));
  return geometry;
}
