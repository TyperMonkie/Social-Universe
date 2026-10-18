"use client";

import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, LineBasicMaterial, MeshBasicMaterial, RingGeometry } from "three";
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
  const rings = useMemo(() => {
    if (spec.geometry.mode === "nebula") return [];
    const radius = spec.geometry.radius;
    const bands = spec.geometry.mode === "sphere"
      ? [
          { inner: 1.19, outer: 1.57, tilt: 0.80, roll: -0.29, opacity: 0.15 },
          { inner: 1.34, outer: 1.38, tilt: 0.80, roll: -0.29, opacity: 0.44 },
        ]
      : [
          { inner: 1.13, outer: 1.42, tilt: 0.68, roll: 0.42, opacity: 0.13 },
          { inner: 1.34, outer: 1.38, tilt: 0.68, roll: 0.42, opacity: 0.42 },
          { inner: 1.53, outer: 1.66, tilt: -0.41, roll: -0.32, opacity: 0.10 },
        ];
    return bands.map((band) => ({
      geometry: new RingGeometry(radius * band.inner, radius * band.outer, 128, 3),
      material: new MeshBasicMaterial({
        color: spec.palette.accent,
        transparent: true,
        opacity: band.opacity,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
      rotation: [band.tilt, 0, band.roll] as [number, number, number],
      opacity: band.opacity,
    }));
  }, [spec]);
  const objects = useMemo(() => Array.from({ length: spec.orbit.count }, (_, index) => ({
    geometry: orbitGeometry(spec, index),
    material: new LineBasicMaterial({
      color: index % 2 === 0 ? spec.palette.accent : spec.palette.outer,
      transparent: true,
      opacity: spec.orbit.opacity * (index === 0 ? 0.50 : 0.36),
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
  useEffect(() => () => {
    rings.forEach(({ geometry, material }) => {
      geometry.dispose();
      material.dispose();
    });
  }, [rings]);

  useFrame((state) => {
    if (group.current) {
      // Counter the rotating planet so the broad rings keep their readable ellipse.
      group.current.rotation.y = -(group.current.parent?.rotation.y ?? 0) + Math.sin(state.clock.elapsedTime * 0.28) * 0.10;
    }
    objects.forEach(({ material }, index) => {
      material.opacity = spec.orbit.opacity * (index === 0 ? 0.50 : 0.36) * (1 - burstAmount.current * 0.72);
    });
    rings.forEach(({ material, opacity }) => {
      material.opacity = opacity * (1 - burstAmount.current * 0.82);
    });
  });

  if (objects.length === 0 && rings.length === 0) return null;
  return (
    <group ref={group}>
      {rings.map(({ geometry, material, rotation }, index) => (
        <mesh key={`ring-${index}`} geometry={geometry} material={material} rotation={rotation} />
      ))}
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
