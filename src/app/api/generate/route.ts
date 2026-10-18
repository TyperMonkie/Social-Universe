import { NextResponse } from "next/server";
import { profileInputSchema, type ProfileInput } from "@/lib/contracts";
import { generateUniverse } from "@/lib/server/generate";
import { GenerationError } from "@/lib/server/muzeai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function errorResponse(code: string, message: string, status: number, stage?: string) {
  return NextResponse.json(
    { error: { code, message, ...(stage ? { stage } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function tidy(input: ProfileInput): ProfileInput {
  return {
    description: input.description.trim(),
    posts: input.posts.map((post) => post.trim()).filter(Boolean),
    interests: input.interests.map((interest) => interest.trim()).filter(Boolean),
    music: input.music
      .map((item) => ({ title: item.title.trim(), artist: item.artist.trim() }))
      .filter((item) => item.title),
  };
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("UNSUPPORTED_MEDIA_TYPE", "请以 JSON 提交个人资料。", 415);
  }

  let raw: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 24_000) {
      return errorResponse("INPUT_TOO_LARGE", "个人资料内容过长，请精简后重试。", 413);
    }
    raw = JSON.parse(body);
  } catch {
    return errorResponse("INVALID_JSON", "请求内容不是有效的 JSON。", 400);
  }

  const parsed = profileInputSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", "个人资料格式不正确，请检查文字、兴趣和音乐字段。", 400);
  }

  const input = tidy(parsed.data);
  if (!input.description && !input.posts.length && !input.interests.length && !input.music.length) {
    return errorResponse("EMPTY_INPUT", "请至少填写一段描述、一条动态、一个兴趣或一首音乐。", 400);
  }

  try {
    const result = await generateUniverse(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GenerationError) {
      return errorResponse(error.code, error.message, error.status, error.stage);
    }
    // Do not include provider responses or credentials in application errors.
    return errorResponse("GENERATION_FAILED", "宇宙生成失败，请稍后重试。", 500);
  }
}
