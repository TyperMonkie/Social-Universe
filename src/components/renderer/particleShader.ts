import { AdditiveBlending, RawShaderMaterial, Vector3 } from "three";
import { validateCreativeExpression } from "@/lib/creative-expression";

const fallbackExpression = "0.0";

export const particleFragmentShader = `
precision highp float;
varying vec3 vColor;
varying float vOpacity;
varying float vLight;

void main() {
  float radius = length(gl_PointCoord - vec2(0.5));
  float disc = 1.0 - smoothstep(0.08, 0.5, radius);
  float heart = exp(-radius * radius * 32.0);
  float alpha = disc * vOpacity * (0.36 + 0.62 * heart);
  if (alpha < 0.012) discard;
  vec3 color = vColor * (0.68 + 0.48 * vLight + 0.68 * heart);
  gl_FragColor = vec4(color, alpha);
}
`;

export function particleVertexShader(expression: string): string {
  return `
precision highp float;
attribute vec3 position;
attribute vec3 color;
attribute vec3 aBurst;
attribute float aSize;
attribute float aSeed;
attribute float aOpacity;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uBurst;
uniform float uBurstDistance;
uniform float uPulse;
uniform float uDrift;
uniform float uInteraction;
uniform float uPointerActive;
uniform float uRadius;
uniform float uPixelRatio;
uniform vec3 uPointer;
varying vec3 vColor;
varying float vOpacity;
varying float vLight;

float creativeDisplacement(vec3 p, float t) {
  return (${expression});
}

void main() {
  vec3 radial = normalize(position + vec3(0.00001));
  vec3 p = position;
  float phase = aSeed * 47.0 + uTime * (0.65 + aSeed * 0.35);
  float breathing = sin(phase) * uPulse * uRadius * 0.035;
  float creative = creativeDisplacement(position / max(uRadius, 0.1), uTime);
  if (!(creative >= -10000.0 && creative <= 10000.0)) creative = 0.0;
  creative = clamp(creative, -1.0, 1.0);
  p += radial * (breathing + creative * uRadius * 0.18);
  p += vec3(sin(phase * 0.6), cos(phase * 0.7), sin(phase * 0.4 + 1.7))
    * uDrift * 0.035;
  p += aBurst * uBurst * uBurstDistance;

  vec3 fromPointer = p - uPointer;
  float distanceToPointer = length(fromPointer);
  float reach = uRadius * 0.78;
  float influence = exp(-distanceToPointer * distanceToPointer / (reach * reach));
  p += normalize(fromPointer + radial * 0.05) * influence * uPointerActive * uInteraction * 0.46;

  vec4 cameraPoint = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * cameraPoint;
  gl_PointSize = clamp(aSize * uPixelRatio * (6.8 / max(-cameraPoint.z, 0.1)) * (1.0 + uBurst * 0.25), 1.0, 24.0);
  float diffuse = max(dot(radial, normalize(vec3(-0.42, 0.72, 0.56))), 0.0);
  vLight = 0.34 + diffuse * 0.66;
  vColor = color;
  vOpacity = aOpacity * (1.0 - uBurst * 0.18);
}
`;
}

function compiles(context: WebGLRenderingContext | WebGL2RenderingContext, vertex: string, fragment: string): boolean {
  const vertexObject = context.createShader(context.VERTEX_SHADER);
  const fragmentObject = context.createShader(context.FRAGMENT_SHADER);
  if (!vertexObject || !fragmentObject) return false;
  const program = context.createProgram();
  if (!program) {
    context.deleteShader(vertexObject);
    context.deleteShader(fragmentObject);
    return false;
  }
  try {
    context.shaderSource(vertexObject, vertex);
    context.compileShader(vertexObject);
    context.shaderSource(fragmentObject, fragment);
    context.compileShader(fragmentObject);
    if (!context.getShaderParameter(vertexObject, context.COMPILE_STATUS) ||
        !context.getShaderParameter(fragmentObject, context.COMPILE_STATUS)) return false;
    context.attachShader(program, vertexObject);
    context.attachShader(program, fragmentObject);
    context.linkProgram(program);
    return Boolean(context.getProgramParameter(program, context.LINK_STATUS));
  } finally {
    context.deleteProgram(program);
    context.deleteShader(vertexObject);
    context.deleteShader(fragmentObject);
  }
}

export function createParticleMaterial(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  proposedExpression: string | null,
): { material: RawShaderMaterial; status: "ok" | "fallback" } {
  // The API validates a pure expression; this local guard also covers imported specs.
  const locallySafe = validateCreativeExpression(proposedExpression);
  const proposed = locallySafe && proposedExpression ? proposedExpression : fallbackExpression;
  const candidate = particleVertexShader(proposed);
  const valid = compiles(context, candidate, particleFragmentShader);
  const status = !valid || (proposedExpression !== null && !locallySafe) ? "fallback" : "ok";
  const material = new RawShaderMaterial({
    vertexShader: valid ? candidate : particleVertexShader(fallbackExpression),
    fragmentShader: particleFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uBurstDistance: { value: 2.8 },
      uPulse: { value: 0.2 },
      uDrift: { value: 0.3 },
      uInteraction: { value: 0.6 },
      uPointerActive: { value: 0 },
      uRadius: { value: 1.5 },
      uPixelRatio: { value: 1 },
      uPointer: { value: new Vector3(0, 0, 100) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return { material, status };
}
