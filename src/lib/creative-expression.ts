/**
 * Accept only a small, side-effect-free GLSL float expression. The shader
 * supplies `vec3 p` and `float t`; everything else is deliberately excluded.
 * The renderer also clamps the resulting displacement at runtime.
 */
const FUNCTION_ARITY: Record<string, number> = {
  sin: 1,
  cos: 1,
  tan: 1,
  abs: 1,
  sqrt: 1,
  exp: 1,
  log: 1,
  floor: 1,
  ceil: 1,
  fract: 1,
  min: 2,
  max: 2,
  pow: 2,
  mod: 2,
  step: 2,
  clamp: 3,
  smoothstep: 3,
  mix: 3,
};

type Token = { kind: "number" | "name" | "symbol"; value: string };

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  let position = 0;

  while (position < source.length) {
    const rest = source.slice(position);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (number) {
      const value = Number(number[0]);
      // GLSL float expressions cannot rely on implicit int-to-float casts.
      if (!/[.eE]/.test(number[0]) || !Number.isFinite(value) || Math.abs(value) > 1000) return null;
      tokens.push({
        kind: "number",
        value: number[0],
      });
      position += number[0].length;
      continue;
    }

    const coordinate = /^p\.[xyz]\b/.exec(rest);
    if (coordinate) {
      tokens.push({ kind: "name", value: coordinate[0] });
      position += coordinate[0].length;
      continue;
    }

    const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(rest);
    if (name) {
      tokens.push({ kind: "name", value: name[0] });
      position += name[0].length;
      continue;
    }

    if ("+-*/(),".includes(rest[0])) {
      tokens.push({ kind: "symbol", value: rest[0] });
      position += 1;
      continue;
    }

    return null;
  }

  return tokens.length <= 80 ? tokens : null;
}

/** Returns a normalized expression, or null when it must be disabled. */
export function validateDisplacementExpression(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const source = input.trim();
  if (!source || source.length > 240) return null;
  if (/\+\+|--/.test(source)) return null;
  const tokens = tokenize(source);
  if (!tokens?.length) return null;

  let cursor = 0;
  let depth = 0;
  let calls = 0;

  const peek = () => tokens[cursor]?.value;
  const accept = (value: string) => {
    if (peek() !== value) return false;
    cursor += 1;
    return true;
  };

  const primary = (): boolean => {
    if (depth > 8) return false;
    const token = tokens[cursor];
    if (!token) return false;

    if (accept("(")) {
      depth += 1;
      const valid = expression() && accept(")");
      depth -= 1;
      return valid;
    }

    if (token.kind === "number") {
      cursor += 1;
      return true;
    }

    if (token.value === "t" || /^p\.[xyz]$/.test(token.value)) {
      cursor += 1;
      return true;
    }

    if (!Object.hasOwn(FUNCTION_ARITY, token.value) || tokens[cursor + 1]?.value !== "(") return false;
    const arity = FUNCTION_ARITY[token.value];
    calls += 1;
    if (calls > 12) return false;
    cursor += 2;
    depth += 1;
    if (depth > 8) return false;
    for (let argument = 0; argument < arity; argument += 1) {
      if (argument > 0 && !accept(",")) return false;
      if (!expression()) return false;
    }
    const valid = accept(")");
    depth -= 1;
    return valid;
  };

  const unary = (): boolean => {
    if (accept("+") || accept("-")) return unary();
    return primary();
  };

  const product = (): boolean => {
    if (!unary()) return false;
    while (peek() === "*" || peek() === "/") {
      const operator = tokens[cursor++].value;
      // A literal zero denominator is always invalid. The renderer handles
      // more complex runtime cases with a bounded final displacement.
      if (operator === "/" && tokens[cursor]?.kind === "number" && Number(tokens[cursor].value) === 0) {
        return false;
      }
      if (!unary()) return false;
    }
    return true;
  };

  const expression = (): boolean => {
    if (!product()) return false;
    while (peek() === "+" || peek() === "-") {
      cursor += 1;
      if (!product()) return false;
    }
    return true;
  };

  if (!expression() || cursor !== tokens.length) return null;
  const normalized = tokens.map((token) => token.value).join(" ");
  return normalized.length <= 240 ? normalized : null;
}

/** Shared check for API results and imported universe documents. */
export function validateCreativeExpression(value: string | null): boolean {
  return value === null || validateDisplacementExpression(value) !== null;
}
