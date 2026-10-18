"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, PointsMaterial } from "three";

export default function Starfield({ seed }: { seed: number }) {
  const geometry = useMemo(() => {
    let state = (seed ^ 0x8a14b27d) >>> 0;
    const random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const positions = new Float32Array(360 * 3);
    for (let index = 0; index < 360; index++) {
      positions[index * 3] = (random() - 0.5) * 22;
      positions[index * 3 + 1] = (random() - 0.5) * 15;
      positions[index * 3 + 2] = -3 - random() * 10;
    }
    const next = new BufferGeometry();
    next.setAttribute("position", new BufferAttribute(positions, 3));
    return next;
  }, [seed]);
  const material = useMemo(() => new PointsMaterial({
    color: "#b5bbec",
    size: 0.024,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    sizeAttenuation: true,
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
