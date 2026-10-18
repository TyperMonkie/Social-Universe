import "server-only";

import {
  renderSpecSchema,
  universeDnaSchema,
  type RenderSpec,
  type UniverseDNA,
} from "../contracts";
import { defaultSpec } from "../default-spec";
import { validateDisplacementExpression } from "../creative-expression";
import { GenerationError } from "./muzeai";

type UnknownObject = Record<string, unknown>;

function asObject(value: unknown): UnknownObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownObject
    : null;
}

function bounded(value: unknown, fallback: number, min: number, max: number, whole = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return whole ? Math.round(clamped) : clamped;
}

function shortText(value: unknown, maxLength: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function hexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${[...color.slice(1)].map((digit) => digit + digit).join("")}`.toLowerCase();
  }
  return fallback;
}

export function normalizeDna(raw: unknown): UniverseDNA {
  const input = asObject(raw);
  if (!input) {
    throw new GenerationError("MODEL_INVALID_DNA", "模型没有生成有效的 Universe DNA。", 502, "profile");
  }

  const candidate = {
    name: shortText(input.name, 80),
    tagline: shortText(input.tagline, 160),
    story: shortText(input.story, 800),
    traits: Array.isArray(input.traits)
      ? input.traits.map((trait) => shortText(trait, 80)).filter(Boolean).slice(0, 6)
      : [],
    visualMetaphor: shortText(input.visualMetaphor, 500),
    emotionalTone: shortText(input.emotionalTone, 160),
    energy: bounded(input.energy, Number.NaN, 0, 1),
    openness: bounded(input.openness, Number.NaN, 0, 1),
  };
  const parsed = universeDnaSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new GenerationError("MODEL_INVALID_DNA", "模型生成的 Universe DNA 缺少必要内容，请重试。", 502, "profile");
  }
  return parsed.data;
}

export function normalizeRenderSpec(raw: unknown, dna: UniverseDNA): RenderSpec {
  const input = asObject(raw);
  const geometry = asObject(input?.geometry);
  const motion = asObject(input?.motion);
  const palette = asObject(input?.palette);
  const orbit = asObject(input?.orbit);
  const creative = asObject(input?.creative);
  if (!input || !geometry || !motion || !palette || !orbit || !creative) {
    throw new GenerationError("MODEL_INVALID_SPEC", "模型没有生成完整的 RenderSpec，请重试。", 502, "style");
  }

  const fallback = defaultSpec;
  const mode = geometry.mode === "sphere" || geometry.mode === "hybrid" || geometry.mode === "nebula"
    ? geometry.mode
    : fallback.geometry.mode;
  const candidate = {
    version: 1 as const,
    seed: bounded(input.seed, fallback.seed, 0, 2147483647, true),
    name: shortText(input.name, 80, dna.name),
    tagline: shortText(input.tagline, 160, dna.tagline),
    geometry: {
      mode,
      count: bounded(geometry.count, fallback.geometry.count, 6000, 60000, true),
      radius: bounded(geometry.radius, fallback.geometry.radius, 0.6, 2.8),
      dispersion: bounded(geometry.dispersion, fallback.geometry.dispersion, 0, 1),
      irregularity: bounded(geometry.irregularity, fallback.geometry.irregularity, 0, 1),
      bands: bounded(geometry.bands, fallback.geometry.bands, 0, 8, true),
    },
    motion: {
      rotationSpeed: bounded(motion.rotationSpeed, fallback.motion.rotationSpeed, -0.4, 0.4),
      pulse: bounded(motion.pulse, fallback.motion.pulse, 0, 1),
      drift: bounded(motion.drift, fallback.motion.drift, 0, 1),
      interaction: bounded(motion.interaction, fallback.motion.interaction, 0, 1),
      burst: bounded(motion.burst, fallback.motion.burst, 0.5, 5),
    },
    palette: {
      inner: hexColor(palette.inner, fallback.palette.inner),
      outer: hexColor(palette.outer, fallback.palette.outer),
      accent: hexColor(palette.accent, fallback.palette.accent),
      background: hexColor(palette.background, fallback.palette.background),
    },
    orbit: {
      count: bounded(orbit.count, fallback.orbit.count, 0, 3, true),
      radius: bounded(orbit.radius, fallback.orbit.radius, 1.2, 4),
      tilt: bounded(orbit.tilt, fallback.orbit.tilt, -1.5, 1.5),
      opacity: bounded(orbit.opacity, fallback.orbit.opacity, 0, 1),
    },
    creative: {
      // Creative code is optional. Rejecting it must not discard a good spec.
      displacement: validateDisplacementExpression(creative.displacement),
    },
  };

  const parsed = renderSpecSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new GenerationError("MODEL_INVALID_SPEC", "模型生成的 RenderSpec 无法验证，请重试。", 502, "style");
  }
  return parsed.data;
}
