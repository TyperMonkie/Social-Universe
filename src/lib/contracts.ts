import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const profileInputSchema = z.object({
  description: z.string().max(4000).default(""),
  posts: z.array(z.string().max(1000)).max(12).default([]),
  interests: z.array(z.string().max(80)).max(20).default([]),
  music: z.array(z.object({ title: z.string().max(120), artist: z.string().max(120).default("") })).max(12).default([]),
  // Reserved for a future image understanding step; image uploads are disabled in v1.
  images: z.array(z.object({ id: z.string(), mimeType: z.string() })).max(0).optional(),
});

export const universeDnaSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  story: z.string().min(1).max(800),
  traits: z.array(z.string().min(1).max(80)).min(2).max(6),
  visualMetaphor: z.string().min(1).max(500),
  emotionalTone: z.string().min(1).max(160),
  energy: z.number().min(0).max(1),
  openness: z.number().min(0).max(1),
});

const normalizedPointSchema = z.tuple([
  z.number().finite().min(-3).max(3),
  z.number().finite().min(-3).max(3),
  z.number().finite().min(-3).max(3),
]).refine(([x, y, z]) => x * x + y * y + z * z <= 2.2 * 2.2, {
  message: "Control point must be within 2.2 planet radii",
});

const motifStrokeSchema = z.strictObject({
  // Coordinates are relative to geometry.radius. The renderer moves sampled
  // points outward to at least 1.04 radii after curve interpolation.
  points: z.array(normalizedPointSchema).min(2).max(12),
  closed: z.boolean(),
  primitive: z.enum(["tube", "beads"]),
}).refine((stroke) => stroke.points.some((point, index) => {
  if (index === 0) return false;
  const previous = stroke.points[index - 1];
  return Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]) >= 0.02;
}), { message: "Stroke points must form a visible path" });

export const motifSchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  strokes: z.array(motifStrokeSchema).min(1).max(4),
  copies: z.number().int().min(1).max(6),
  axis: z.enum(["x", "y", "z"]),
  color: hexColor,
  // Relative to geometry.radius, including bead/tube radius.
  width: z.number().finite().min(0.003).max(0.035),
  opacity: z.number().finite().min(0.05).max(0.65),
  motion: z.strictObject({
    spin: z.number().finite().min(-0.25).max(0.25),
    breathe: z.number().finite().min(0).max(0.08),
    shimmer: z.number().finite().min(0).max(1.5),
    phase: z.number().finite().min(0).max(6.28),
  }),
});

export const MAX_MOTIFS = 3;
export const MAX_MOTIF_STROKE_COPIES = 48;
export const MAX_MOTIF_WEIGHTED_POINTS = 400;

export type Motif = z.infer<typeof motifSchema>;

function withinMotifBudget(motifs: Motif[]): boolean {
  const strokeCopies = motifs.reduce((sum, motif) => sum + motif.strokes.length * motif.copies, 0);
  const weightedPoints = motifs.reduce(
    (sum, motif) => sum + motif.strokes.reduce((points, stroke) => points + stroke.points.length, 0) * motif.copies,
    0,
  );
  return strokeCopies <= MAX_MOTIF_STROKE_COPIES && weightedPoints <= MAX_MOTIF_WEIGHTED_POINTS;
}

export const motifsSchema = z.array(motifSchema).max(MAX_MOTIFS).refine(withinMotifBudget, {
  message: "Motifs exceed the rendering budget",
});

export const frogSchema = z.strictObject({
  accessory: z.enum(["guitar", "camera", "ball", "microphone", "book", "none"]),
  badgeText: z.string().trim().max(20),
  accentColor: hexColor,
});

export type FrogSpec = z.infer<typeof frogSchema>;

export const symbolSchema = z.strictObject({
  icon: z.enum(["rock-horns", "guitar", "camera", "ball", "music", "book", "map", "star"]),
  label: z.string().trim().min(1).max(20),
  color: hexColor,
});

export const symbolsSchema = z.array(symbolSchema).max(2);
export type SurfaceSymbol = z.infer<typeof symbolSchema>;

/** Keep valid motifs while dropping malformed or over-budget items individually. */
export function retainValidMotifs(raw: unknown): Motif[] {
  if (!Array.isArray(raw)) return [];
  const retained: Motif[] = [];
  for (const value of raw) {
    if (retained.length >= MAX_MOTIFS) break;
    const parsed = motifSchema.safeParse(value);
    if (!parsed.success) continue;
    const next = [...retained, parsed.data];
    if (motifsSchema.safeParse(next).success) retained.push(parsed.data);
  }
  return retained;
}

/** Keep model-drawn contours close enough to the body for readable detail. */
export function fitGeneratedMotifs(raw: unknown): Motif[] {
  return retainValidMotifs(raw).flatMap((motif) => {
    const farthest = Math.max(...motif.strokes.flatMap((stroke) =>
      stroke.points.map(([x, y, z]) => Math.hypot(x, y, z)),
    ));
    if (farthest <= 1.7) return [motif];
    const scale = 1.7 / farthest;
    const fitted: Motif = {
      ...motif,
      strokes: motif.strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map(([x, y, z]) => [x * scale, y * scale, z * scale]),
      })),
    };
    return motifSchema.safeParse(fitted).success ? [fitted] : [];
  });
}

const baseRenderSpecSchema = z.object({
  seed: z.number().int().min(0).max(2147483647),
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  geometry: z.object({
    mode: z.enum(["sphere", "hybrid", "nebula"]),
    count: z.number().int().min(6000).max(60000),
    radius: z.number().min(0.6).max(2.8),
    dispersion: z.number().min(0).max(1),
    irregularity: z.number().min(0).max(1),
    bands: z.number().int().min(0).max(8),
  }),
  motion: z.object({
    rotationSpeed: z.number().min(-0.4).max(0.4),
    pulse: z.number().min(0).max(1),
    drift: z.number().min(0).max(1),
    interaction: z.number().min(0).max(1),
    burst: z.number().min(0.5).max(5),
  }),
  palette: z.object({
    inner: hexColor,
    outer: hexColor,
    accent: hexColor,
    background: hexColor,
  }),
  orbit: z.object({
    count: z.number().int().min(0).max(3),
    radius: z.number().min(1.2).max(4),
    tilt: z.number().min(-1.5).max(1.5),
    opacity: z.number().min(0).max(1),
  }),
  creative: z.object({
    // One validated GLSL float expression, applied as particle displacement.
    displacement: z.string().max(240).nullable(),
  }),
});

export const renderSpecV1Schema = baseRenderSpecSchema.extend({
  version: z.literal(1),
});

export const renderSpecV2Schema = baseRenderSpecSchema.extend({
  version: z.literal(2),
  motifs: motifsSchema,
  // Optional so pre-frog v2 exports stay importable. Fresh AI generation fills it.
  frog: frogSchema.optional(),
  // Optional so earlier v2 exports remain importable.
  symbols: symbolsSchema.optional(),
});

export const renderSpecSchema = z.discriminatedUnion("version", [renderSpecV1Schema, renderSpecV2Schema]);

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type UniverseDNA = z.infer<typeof universeDnaSchema>;
export type RenderSpec = z.infer<typeof renderSpecSchema>;

export type UniverseDocument = {
  format: "personaverse-universe";
  version: 1;
  input?: ProfileInput;
  dna?: UniverseDNA;
  spec: RenderSpec;
};
