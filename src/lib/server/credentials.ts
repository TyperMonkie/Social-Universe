import "server-only";

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Keep credential loading on the server and never include the value in errors. */
export async function getMuzeApiKey(): Promise<string | null> {
  const fromEnvironment = process.env.MUZEAI_API_KEY?.trim();
  if (fromEnvironment) return fromEnvironment;

  if (process.platform !== "win32") return null;

  try {
    const config = await readFile(join(homedir(), ".codex", "config.toml"), "utf8");
    let inMuzeSection = false;
    for (const line of config.split(/\r?\n/)) {
      const section = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
      if (section) {
        inMuzeSection = section[1] === "model_providers.muzeai";
        continue;
      }
      if (!inMuzeSection) continue;
      const match = /^\s*experimental_bearer_token\s*=\s*(["'])(.*?)\1\s*(?:#.*)?$/.exec(line);
      if (match?.[2]?.trim()) return match[2].trim();
    }
    return null;
  } catch {
    return null;
  }
}
