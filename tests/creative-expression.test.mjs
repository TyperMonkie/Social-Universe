import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCreativeExpression,
  validateDisplacementExpression,
} from "../src/lib/creative-expression.ts";

test("accepts a bounded GLSL float expression in the agreed shader context", () => {
  const value = "0.08 * sin(5.0 * p.x + t) + 0.03 * cos(p.z * 4.0)";
  assert.equal(validateCreativeExpression(value), true);
  assert.match(validateDisplacementExpression(value), /^0\.08 \* sin/);
  assert.equal(validateCreativeExpression(null), true);
});

test("rejects statements, unsupported symbols and identifiers", () => {
  const invalid = [
    "p.x; gl_Position = vec4(0.0)",
    "for (int i = 0; i < 10; i++) {}",
    "#define X 1.0",
    "texture2D(map, p.xy)",
    "evil(p.x)",
    "p.w",
    "p.x > 0.0 ? 1.0 : 0.0",
    "1.0 // comment",
    "1.0 / 0.0",
    "sin(1.0, t)",
    "clamp(p.x, 0.0)",
    "constructor(p.x)",
    "p.x + 1",
    "++p.x",
    "--p.x",
  ];
  for (const expression of invalid) {
    assert.equal(validateDisplacementExpression(expression), null, expression);
  }
});

test("rejects oversized or deeply nested expressions", () => {
  assert.equal(validateDisplacementExpression("p.x + ".repeat(50) + "0.0"), null);
  assert.equal(validateDisplacementExpression("(".repeat(10) + "p.x" + ")".repeat(10)), null);
});
