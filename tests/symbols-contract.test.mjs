import assert from "node:assert/strict";
import test from "node:test";
import { defaultSpec } from "../src/lib/default-spec.ts";
import { renderSpecSchema } from "../src/lib/contracts.ts";
import { deriveSymbolsFromInput, normalizeSymbols } from "../src/lib/symbols.ts";

const source = {
  interests: ["摄影", "旅行地图"],
  music: [{ title: "November Rain", artist: "Gun N' Roses" }],
};
const frog = { accessory: "camera", badgeText: "摄影", accentColor: "#ffeebb" };

test("v1 and older v2 imports remain valid without symbols", () => {
  assert.equal(renderSpecSchema.safeParse(defaultSpec).success, true);
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: [] }).success, true);
});

test("model symbols keep real labels, reject invented artist and duplicate frog icon", () => {
  const symbols = normalizeSymbols([
    { icon: "camera", label: "摄影", color: "#ffffff" },
    { icon: "rock-horns", label: "Made Up Band", color: "#ffffff" },
    { icon: "rock-horns", label: "Gun N' Roses", color: "#ffffff" },
    { icon: "map", label: "旅行地图", color: "bad" },
  ], source, frog, "#080615");
  assert.deepEqual(symbols.map((symbol) => symbol.label), ["Gun N' Roses", "旅行地图"]);
  assert.ok(symbols.every((symbol) => /^#[0-9a-f]{6}$/.test(symbol.color)));
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: [], symbols }).success, true);
});

test("old import fallback is deterministic, bounded and complementary to frog", () => {
  const first = deriveSymbolsFromInput(source, frog, "#080615");
  const second = deriveSymbolsFromInput(source, frog, "#080615");
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].icon, "camera");
  assert.ok(first.every((symbol) => ["摄影", "旅行地图", "Gun N' Roses", "November Rain"].includes(symbol.label)));
  assert.deepEqual(deriveSymbolsFromInput(undefined), []);
});
