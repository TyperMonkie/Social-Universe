"use client";

import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PerspectiveCamera } from "three";
import type { RenderSpec } from "@/lib/contracts";
import ParticlePlanet from "./renderer/ParticlePlanet";
import Starfield from "./renderer/Starfield";

export type UniverseSceneProps = {
  spec: RenderSpec;
  burst: boolean;
  onShaderStatus?: (status: "ok" | "fallback") => void;
};

function CameraDistance({ spec }: { spec: RenderSpec }) {
  const { camera } = useThree();
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    perspective.position.set(0, 0, Math.max(7.6, spec.geometry.radius * 4.75));
    perspective.updateProjectionMatrix();
  }, [camera, spec.geometry.radius]);
  return null;
}

export default function UniverseScene({ spec, burst, onShaderStatus }: UniverseSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, Math.max(7.6, spec.geometry.radius * 4.75)], fov: 48, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      style={{ width: "100%", height: "100%", background: spec.palette.background }}
    >
      <color attach="background" args={[spec.palette.background]} />
      <CameraDistance spec={spec} />
      <Starfield seed={spec.seed} />
      <ParticlePlanet spec={spec} burst={burst} onShaderStatus={onShaderStatus} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.065}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        minDistance={spec.geometry.radius * 2.3}
        maxDistance={spec.geometry.radius * 9}
      />
    </Canvas>
  );
}
