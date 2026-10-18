import "server-only";

import { getMuzeApiKey } from "./credentials";

export type GenerationStage = "profile" | "style";

export class GenerationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly stage?: GenerationStage,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

type JsonSchema = Record<string, unknown>;

const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const text = { type: "string" };
const number = { type: "number" };
const integer = { type: "integer" };
const motif = object({
  label: text,
  strokes: {
    type: "array",
    items: object({
      // Avoid tuple/prefixItems here for broad Responses-compatible gateways;
      // the shared Zod contract checks exactly three finite numbers per point.
      points: { type: "array", items: { type: "array", items: number } },
      closed: { type: "boolean" },
      primitive: { type: "string", enum: ["tube", "beads"] },
    }),
  },
  copies: integer,
  axis: { type: "string", enum: ["x", "y", "z"] },
  color: text,
  width: number,
  opacity: number,
  motion: object({
    spin: number,
    breathe: number,
    shimmer: number,
    phase: number,
  }),
});

export const DNA_JSON_SCHEMA = object({
  name: text,
  tagline: text,
  story: text,
  traits: { type: "array", items: text },
  visualMetaphor: text,
  emotionalTone: text,
  energy: number,
  openness: number,
});

export const SPEC_JSON_SCHEMA = object({
  version: { type: "integer", enum: [2] },
  seed: integer,
  name: text,
  tagline: text,
  geometry: object({
    mode: { type: "string", enum: ["sphere", "hybrid", "nebula"] },
    count: integer,
    radius: number,
    dispersion: number,
    irregularity: number,
    bands: integer,
  }),
  motion: object({
    rotationSpeed: number,
    pulse: number,
    drift: number,
    interaction: number,
    burst: number,
  }),
  palette: object({ inner: text, outer: text, accent: text, background: text }),
  orbit: object({ count: integer, radius: number, tilt: number, opacity: number }),
  creative: object({ displacement: { type: ["string", "null"] } }),
  // A required object guarantees the model proposes at least one freely drawn
  // motif without relying on minItems, which some compatible gateways reject.
  primaryMotif: motif,
  additionalMotifs: { type: "array", items: motif },
  frog: object({
    accessory: { type: "string", enum: ["guitar", "camera", "ball", "microphone", "book", "none"] },
    badgeText: text,
    accentColor: text,
  }),
  symbols: {
    type: "array",
    items: object({
      icon: { type: "string", enum: ["rock-horns", "guitar", "camera", "ball", "music", "book", "map", "star"] },
      label: text,
      color: text,
    }),
  },
});

function outputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return null;

  const parts: string[] = [];
  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const typed = part as Record<string, unknown>;
      if (typed.type === "refusal") return null;
      if (typed.type === "output_text" && typeof typed.text === "string") {
        parts.push(typed.text);
      }
    }
  }
  return parts.length ? parts.join("") : null;
}

export async function requestStructuredJson(
  stage: GenerationStage,
  instructions: string,
  input: unknown,
  schema: JsonSchema,
): Promise<unknown> {
  const apiKey = await getMuzeApiKey();
  if (!apiKey) {
    throw new GenerationError(
      "CONFIG_MISSING",
      "未找到服务端 MuzeAI 密钥。请配置 MUZEAI_API_KEY。",
      503,
      stage,
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.muzeai.top/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-sol",
        instructions,
        input: [{ role: "user", content: JSON.stringify(input) }],
        text: {
          format: {
            type: "json_schema",
            name: stage === "profile" ? "universe_dna" : "render_spec",
            strict: true,
            schema,
          },
        },
        max_output_tokens: stage === "style" ? 4500 : 3000,
        store: false,
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new GenerationError(
      isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNREACHABLE",
      isTimeout ? "模型服务响应超时，请重试。" : "无法连接模型服务，请稍后重试。",
      isTimeout ? 504 : 502,
      stage,
    );
  }

  if (!response.ok) {
    const auth = response.status === 401 || response.status === 403;
    const limited = response.status === 429;
    throw new GenerationError(
      auth ? "PROVIDER_AUTH_FAILED" : limited ? "PROVIDER_RATE_LIMITED" : "PROVIDER_ERROR",
      auth
        ? "模型服务认证失败，请检查服务端 MuzeAI 密钥。"
        : limited
          ? "模型服务请求过于频繁，请稍后重试。"
          : `模型服务请求失败（HTTP ${response.status}）。`,
      limited ? 503 : 502,
      stage,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new GenerationError("PROVIDER_BAD_RESPONSE", "模型服务返回了无法解析的响应。", 502, stage);
  }

  const bodyStatus = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  if (bodyStatus === "incomplete" || bodyStatus === "failed") {
    throw new GenerationError("MODEL_INCOMPLETE", "模型未能完成生成，请重试。", 502, stage);
  }

  const output = outputText(body)?.trim();
  if (!output) {
    throw new GenerationError("MODEL_NO_OUTPUT", "模型没有返回可用的结构化内容。", 502, stage);
  }

  try {
    // Some compatible gateways wrap otherwise valid JSON in a code fence.
    const json = output.startsWith("```")
      ? output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : output;
    return JSON.parse(json);
  } catch {
    throw new GenerationError("MODEL_INVALID_JSON", "模型返回的结构化内容无法解析，请重试。", 502, stage);
  }
}
