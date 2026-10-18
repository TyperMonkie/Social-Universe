"use client";

import { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Group, Points, RawShaderMaterial, Vector3 } from "three";
import type { RenderSpec } from "@/lib/contracts";
import { createParticleGeometry } from "./particleGeometry";
import { createParticleMaterial } from "./particleShader";
import Halo from "./Halo";
import OrbitTrails from "./OrbitTrails";

type Props = {
  spec: RenderSpec;
  burst: boolean;
  onShaderStatus?: (status: "ok" | "fallback") => void;
};

export default function ParticlePlanet({ spec, burst, onShaderStatus }: Props) {
  const group = useRef<Group>(null);
  const points = useRef<Points>(null);
  const pointerWorld = useRef(new Vector3(0, 0, 100));
  const pointerLocal = useRef(new Vector3());
  const pointerTarget = useRef(0);
  const pointerStrength = useRef(0);
  const burstAmount = useRef(0);
  const callback = useRef(onShaderStatus);

  const { gl } = useThree();
  const geometry = useMemo(() => createParticleGeometry(spec), [spec]);
  const shader = useMemo(
    () => createParticleMaterial(gl.getContext(), spec.creative.displacement),
    [gl, spec.creative.displacement],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => { callback.current = onShaderStatus; }, [onShaderStatus]);
  useEffect(() => {
    callback.current?.(shader.status);
    return () => shader.material.dispose();
  }, [shader]);

  useFrame((state, delta) => {
    const easing = 1 - Math.exp(-delta * 3.5);
    burstAmount.current += ((burst ? 1 : 0) - burstAmount.current) * easing;
    pointerStrength.current += (pointerTarget.current - pointerStrength.current) * (1 - Math.exp(-delta * 5));
    if (group.current) {
      group.current.rotation.y += delta * spec.motion.rotationSpeed;
      pointerLocal.current.copy(pointerWorld.current);
      group.current.worldToLocal(pointerLocal.current);
    }
    if (!points.current) return;
    const uniforms = (points.current.material as RawShaderMaterial).uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uBurst.value = burstAmount.current;
    uniforms.uBurstDistance.value = spec.motion.burst;
    uniforms.uPulse.value = spec.motion.pulse;
    uniforms.uDrift.value = spec.motion.drift;
    uniforms.uInteraction.value = spec.motion.interaction;
    uniforms.uPointerActive.value = pointerStrength.current;
    uniforms.uRadius.value = spec.geometry.radius;
    uniforms.uPixelRatio.value = gl.getPixelRatio();
    (uniforms.uPointer.value as Vector3).copy(pointerLocal.current);
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    pointerWorld.current.copy(event.point);
    pointerTarget.current = 1;
  };

  return (
    <group ref={group}>
      <Halo spec={spec} burstAmount={burstAmount} />
      <OrbitTrails spec={spec} burstAmount={burstAmount} />
      <points ref={points} geometry={geometry} material={shader.material} frustumCulled={false} />
      <mesh
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerMove}
        onPointerOut={() => { pointerTarget.current = 0; }}
      >
        <sphereGeometry args={[spec.geometry.radius * 1.14, 24, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}
