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

export const renderSpecSchema = z.object({
  version: z.literal(1),
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
