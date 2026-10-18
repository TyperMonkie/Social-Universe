import type { FrogSpec, ProfileInput } from "./contracts";

const ACCESSORIES = new Set<FrogSpec["accessory"]>([
  "guitar", "camera", "ball", "microphone", "book", "none",
]);

type FrogSource = Pick<ProfileInput, "interests" | "music">;

function safeShortLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const characters = Array.from(value.trim());
  while (characters.join("").length > 20) characters.pop();
  return characters.join("");
}

function groundedBadge(value: unknown, source: FrogSource): string {
  const badge = safeShortLabel(value);
  if (!badge) return "";
  const claims = [
    ...source.interests,
    ...source.music.flatMap((track) => [track.title, track.artist]),
  ];
  const needle = badge.toLocaleLowerCase();
  return claims.some((claim) => claim.toLocaleLowerCase().includes(needle)) ? badge : "";
}

/** Normalize optional AI frog styling without changing the fixed frog body. */
export function normalizeFrog(
  raw: unknown,
  paletteAccent: string,
  source: FrogSource,
): FrogSpec {
  const input = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const accessory = typeof input.accessory === "string" && ACCESSORIES.has(input.accessory as FrogSpec["accessory"])
    ? input.accessory as FrogSpec["accessory"]
    : "none";
  const accentColor = typeof input.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accentColor)
    ? input.accentColor.toLowerCase()
    : /^#[0-9a-fA-F]{6}$/.test(paletteAccent) ? paletteAccent : "#7de8ff";
  return {
    accessory,
    badgeText: groundedBadge(input.badgeText, source),
    accentColor,
  };
}
