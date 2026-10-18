"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Group, Points, RawShaderMaterial, Vector3 } from "three";
import type { RenderSpec } from "@/lib/contracts";
import { createParticleGeometry } from "./particleGeometry";
import { createParticleMaterial } from "./particleShader";
import Halo from "./Halo";
import OrbitTrails from "./OrbitTrails";
import MotifLayer from "./MotifLayer";

type Props = {
  spec: RenderSpec;
  burst: boolean;
  onShaderStatus?: (status: "ok" | "fallback") => void;
  frogOverlay?: RefObject<HTMLDivElement | null>;
  symbolOverlays?: readonly [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>];
};

function positionFrog(element: HTMLDivElement, x: number, y: number, scale: number, opacity: number) {
  element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-18%, -24%) scale(${scale})`;
  element.style.opacity = opacity.toFixed(3);
}

function positionSymbol(element: HTMLDivElement, x: number, y: number, opacity: number) {
  element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  element.style.opacity = opacity.toFixed(3);
}

export default function ParticlePlanet({ spec, burst, onShaderStatus, frogOverlay, symbolOverlays }: Props) {
  const group = useRef<Group>(null);
  const points = useRef<Points>(null);
  const pointerWorld = useRef(new Vector3(0, 0, 100));
  const pointerLocal = useRef(new Vector3());
  const cameraFront = useRef(new Vector3());
  const cameraRight = useRef(new Vector3());
  const cameraUp = useRef(new Vector3());
  const frogWorld = useRef(new Vector3());
  const frogScreen = useRef(new Vector3());
  const symbolWorld = useRef([new Vector3(), new Vector3()]);
  const symbolScreen = useRef([new Vector3(), new Vector3()]);
  const pointerTarget = useRef(0);
  const pointerStrength = useRef(0);
  const burstAmount = useRef(0);
  const callback = useRef(onShaderStatus);

  const { gl, size } = useThree();
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
      group.current.updateWorldMatrix(true, false);
      pointerLocal.current.copy(pointerWorld.current);
      group.current.worldToLocal(pointerLocal.current);
      // Keep the character and personal marks on the camera-facing hemisphere.
      // They remain readable while the particle body rotates or the user orbits.
      cameraFront.current.copy(state.camera.position).normalize();
      cameraRight.current.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
      cameraUp.current.set(0, 1, 0).applyQuaternion(state.camera.quaternion);
      if (frogOverlay?.current) {
        frogWorld.current.copy(cameraFront.current).multiplyScalar(0.64)
          .addScaledVector(cameraRight.current, 0.75)
          .addScaledVector(cameraUp.current, -0.18)
          .normalize().multiplyScalar(spec.geometry.radius * (1.14 + burstAmount.current * 0.22));
        frogScreen.current.copy(frogWorld.current).project(state.camera);
        const x = (frogScreen.current.x * 0.5 + 0.5) * size.width;
        const y = (-frogScreen.current.y * 0.5 + 0.5) * size.height;
        const inside = x > 48 && x < size.width - 48 && y > 68 && y < size.height - 138;
        const opacity = inside ? 1 - burstAmount.current * 0.3 : 0;
        const scale = 0.98 + burstAmount.current * 0.12;
        positionFrog(frogOverlay.current, x, y, scale, opacity);
      }
      const anchors = [[-0.56, 0.42, 0.72], [0.38, 0.54, 0.72]] as const;
      symbolOverlays?.forEach((overlay, index) => {
        if (!overlay.current) return;
        const [ax, ay, az] = anchors[index];
        const world = symbolWorld.current[index].copy(cameraFront.current).multiplyScalar(az)
          .addScaledVector(cameraRight.current, ax)
          .addScaledVector(cameraUp.current, ay)
          .normalize().multiplyScalar(spec.geometry.radius * (1.16 + burstAmount.current * 0.10));
        const screen = symbolScreen.current[index].copy(world).project(state.camera);
        const x = (screen.x * 0.5 + 0.5) * size.width;
        const y = (-screen.y * 0.5 + 0.5) * size.height;
        const visible = x > 48 && x < size.width - 48 && y > 52 && y < size.height - 135;
        const opacity = visible ? 1 - burstAmount.current * 0.55 : 0;
        positionSymbol(overlay.current, x, y, opacity);
      });
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
      <MotifLayer spec={spec} burstAmount={burstAmount} />
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
