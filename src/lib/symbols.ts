import type { FrogSpec, ProfileInput, SurfaceSymbol } from "./contracts";

type Source = Pick<ProfileInput, "interests" | "music"> | undefined;
type Colors = string | { inner?: string; outer?: string; background?: string } | undefined;

const FALLBACK_LIGHT = "#fff0a6";
const FALLBACK_DARK = "#172047";

function trimLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const chars = Array.from(value.trim());
  while (chars.join("").length > 20) chars.pop();
  return chars.join("");
}

function luminance(color: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 0;
  const channels = [1, 3, 5].map((index) => {
    const srgb = parseInt(color.slice(index, index + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function referenceColors(colors: Colors): string[] {
  if (typeof colors === "string") return [colors];
  const samples = [colors?.inner, colors?.outer, colors?.background].filter((value): value is string => Boolean(value));
  return samples.length ? samples : ["#080615"];
}

function visibleColor(proposed: unknown, colors: Colors): string {
  const references = referenceColors(colors);
  const weakestContrast = (color: string) => Math.min(...references.map((reference) => contrast(color, reference)));
  const candidate = typeof proposed === "string" && /^#[0-9a-fA-F]{6}$/.test(proposed)
    ? proposed.toLowerCase()
    : "";
  if (candidate && weakestContrast(candidate) >= 3) return candidate;
  return weakestContrast(FALLBACK_LIGHT) >= weakestContrast(FALLBACK_DARK)
    ? FALLBACK_LIGHT
    : FALLBACK_DARK;
}

function sourceLabels(source: Source): string[] {
  if (!source) return [];
  return [
    ...source.interests,
    ...source.music.flatMap((track) => [track.artist, track.title]),
  ].map((value) => value.trim()).filter(Boolean);
}

function grounded(label: string, source: Source): boolean {
  const needle = label.toLocaleLowerCase();
  return sourceLabels(source).some((claim) => claim.toLocaleLowerCase().includes(needle));
}

function guessIcon(label: string): SurfaceSymbol["icon"] {
  if (/guns?\s*n[\s'’]*roses|rock|metal|摇滚|金属/i.test(label)) return "rock-horns";
  if (/guitar|吉他/i.test(label)) return "guitar";
  if (/photo|camera|摄影|相机/i.test(label)) return "camera";
  if (/ball|basket|soccer|football|tennis|篮球|足球|球/i.test(label)) return "ball";
  if (/book|read|literature|阅读|书|文学/i.test(label)) return "book";
  if (/travel|map|hike|旅行|地图|徒步/i.test(label)) return "map";
  if (/music|song|sing|音乐|歌曲|唱/i.test(label)) return "music";
  return "star";
}

function complementsFrog(icon: SurfaceSymbol["icon"], frog?: FrogSpec): boolean {
  return icon !== frog?.accessory;
}

/** Deterministic fallback for older imported documents that retain user input. */
export function deriveSymbolsFromInput(
  source: Source,
  frog?: FrogSpec,
  colors?: Colors,
): SurfaceSymbol[] {
  const output: SurfaceSymbol[] = [];
  for (const claim of sourceLabels(source)) {
    if (output.length >= 2) break;
    const label = trimLabel(claim);
    if (!label || output.some((symbol) => symbol.label.toLocaleLowerCase() === label.toLocaleLowerCase())) continue;
    const preferred = guessIcon(claim);
    const icon = complementsFrog(preferred, frog) ? preferred : "star";
    output.push({ icon, label, color: visibleColor(null, colors) });
  }
  return output;
}

/** Filter model-proposed symbols individually, then fill from real input. */
export function normalizeSymbols(
  raw: unknown,
  source: Source,
  frog?: FrogSpec,
  colors?: Colors,
): SurfaceSymbol[] {
  const proposed: SurfaceSymbol[] = [];
  if (Array.isArray(raw)) {
    const allowed = new Set<SurfaceSymbol["icon"]>([
      "rock-horns", "guitar", "camera", "ball", "music", "book", "map", "star",
    ]);
    for (const value of raw) {
      if (proposed.length >= 2) break;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      const label = trimLabel(item.label);
      if (!label || !grounded(label, source)) continue;
      if (typeof item.icon !== "string" || !allowed.has(item.icon as SurfaceSymbol["icon"])) continue;
      const icon = item.icon as SurfaceSymbol["icon"];
      if (!complementsFrog(icon, frog)) continue;
      if (proposed.some((symbol) => symbol.label.toLocaleLowerCase() === label.toLocaleLowerCase())) continue;
      proposed.push({ icon, label, color: visibleColor(item.color, colors) });
    }
  }
  if (proposed.length >= 2) return proposed;
  for (const fallback of deriveSymbolsFromInput(source, frog, colors)) {
    if (proposed.length >= 2) break;
    if (!proposed.some((symbol) => symbol.label.toLocaleLowerCase() === fallback.label.toLocaleLowerCase())) {
      proposed.push(fallback);
    }
  }
  return proposed;
}
