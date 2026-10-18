"use client";

import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial } from "three";
import type { RenderSpec } from "@/lib/contracts";

type Props = { spec: RenderSpec; burstAmount: MutableRefObject<number> };

function orbitGeometry(spec: RenderSpec, orbitIndex: number): BufferGeometry {
  const vertices: number[] = [];
  const radius = Math.max(spec.orbit.radius, spec.geometry.radius * 1.18) + orbitIndex * 0.21;
  const segments = 280;
  const phase = orbitIndex * 1.86 + spec.seed * 0.0003;
  for (let step = 0; step < segments; step++) {
    const theta = step / segments * Math.PI * 2;
    // Deliberate gaps make each orbit a trail, not a perfect wire circle.
    if (Math.sin(theta * (3 + orbitIndex) + phase) < -0.49 ||
        Math.sin(theta * 11 + phase * 3) < -0.91) continue;
    for (const t of [theta, (step + 1) / segments * Math.PI * 2]) {
      const warped = radius * (1 + 0.035 * Math.sin(t * 4 + phase));
      vertices.push(
        Math.cos(t) * warped,
        Math.sin(t * 2 + phase) * radius * 0.07,
        Math.sin(t) * warped * (0.78 + orbitIndex * 0.055),
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  return geometry;
}

export default function OrbitTrails({ spec, burstAmount }: Props) {
  const group = useRef<Group>(null);
  const objects = useMemo(() => Array.from({ length: spec.orbit.count }, (_, index) => ({
    geometry: orbitGeometry(spec, index),
    material: new LineBasicMaterial({
      color: index % 2 === 0 ? spec.palette.accent : spec.palette.outer,
      transparent: true,
      opacity: spec.orbit.opacity * (index === 0 ? 0.32 : 0.22),
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  })), [spec]);

  useEffect(() => () => {
    objects.forEach(({ geometry, material }) => {
      geometry.dispose();
      material.dispose();
    });
  }, [objects]);

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.025;
    objects.forEach(({ material }, index) => {
      material.opacity = spec.orbit.opacity * (index === 0 ? 0.32 : 0.22) * (1 - burstAmount.current * 0.72);
    });
  });

  if (objects.length === 0) return null;
  return (
    <group ref={group}>
      {objects.map(({ geometry, material }, index) => (
        <lineSegments
          key={index}
          geometry={geometry}
          material={material}
          rotation={[spec.orbit.tilt + index * 0.23, index * 0.36, index * 0.31]}
        />
      ))}
    </group>
  );
}
