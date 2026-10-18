"use client";

import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from "three";
import type { RenderSpec } from "@/lib/contracts";

type Props = { spec: RenderSpec; burstAmount: MutableRefObject<number> };

const vertexShader = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const fragmentShader = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float edge = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
  float glow = pow(clamp(edge, 0.0, 1.0), 2.6);
  gl_FragColor = vec4(uColor * (0.48 + glow * 0.8), glow * uOpacity);
}
`;

export default function Halo({ spec, burstAmount }: Props) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => new SphereGeometry(1, 48, 32), []);
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new Color(spec.palette.outer) },
      uOpacity: { value: 0.24 },
    },
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
  }), [spec.palette.outer]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const scale = spec.geometry.radius * (spec.geometry.mode === "nebula" ? 1.67 : 1.24);
    mesh.current?.scale.setScalar(scale * (1 + burstAmount.current * 0.32));
    if (mesh.current) {
      (mesh.current.material as ShaderMaterial).uniforms.uOpacity.value =
        (spec.geometry.mode === "nebula" ? 0.14 : 0.24) * (1 - burstAmount.current * 0.55);
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} />;
}
