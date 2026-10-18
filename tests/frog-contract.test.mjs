import assert from "node:assert/strict";
import test from "node:test";
import { renderSpecSchema } from "../src/lib/contracts.ts";
import { defaultSpec } from "../src/lib/default-spec.ts";
import { normalizeFrog } from "../src/lib/frog.ts";

const source = {
  interests: ["摄影", "长跑"],
  music: [{ title: "November Rain", artist: "Gun N' Roses" }],
};

test("old v1 and pre-frog v2 documents stay valid", () => {
  assert.equal(renderSpecSchema.safeParse(defaultSpec).success, true);
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: [] }).success, true);
});

test("one accessory and grounded badge survive normalization", () => {
  const frog = normalizeFrog({
    accessory: "guitar",
    badgeText: "Gun N' Roses",
    accentColor: "#F098BB",
  }, "#445566", source);
  assert.deepEqual(frog, {
    accessory: "guitar",
    badgeText: "Gun N' Roses",
    accentColor: "#f098bb",
  });
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: [], frog }).success, true);
});

test("invented badge and unsupported accessory fall back safely", () => {
  const frog = normalizeFrog({
    accessory: "guitar,camera",
    badgeText: "Imaginary Artist",
    accentColor: "javascript:alert(1)",
  }, "#445566", source);
  assert.deepEqual(frog, { accessory: "none", badgeText: "", accentColor: "#445566" });
});

test("badge truncates to 20 UTF-16 units without splitting a character", () => {
  const long = "世界交响梦境音乐记录漫游远方星光旅行";
  const frog = normalizeFrog({ accessory: "book", badgeText: long, accentColor: "#123456" }, "#445566", {
    interests: [long], music: [],
  });
  assert.ok(frog.badgeText.length <= 20);
  assert.ok(long.startsWith(frog.badgeText));
  assert.equal(renderSpecSchema.safeParse({ ...defaultSpec, version: 2, motifs: [], frog }).success, true);
});
