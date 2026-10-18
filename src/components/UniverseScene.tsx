"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PerspectiveCamera } from "three";
import type { ProfileInput, RenderSpec } from "@/lib/contracts";
import { deriveSymbolsFromInput } from "@/lib/symbols";
import ParticlePlanet from "./renderer/ParticlePlanet";
import Starfield from "./renderer/Starfield";
import FrogCharacter, { type FrogAccessory } from "./FrogCharacter";
import SurfaceSymbolArt from "./SurfaceSymbolArt";

export type UniverseSceneProps = {
  spec: RenderSpec;
  sourceInput?: ProfileInput;
  burst: boolean;
  onShaderStatus?: (status: "ok" | "fallback") => void;
};

function CameraDistance({ spec }: { spec: RenderSpec }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    perspective.position.set(0, 0, cameraDistance(spec, size.width / Math.max(size.height, 1)));
    perspective.updateProjectionMatrix();
  }, [camera, spec, size.width, size.height]);
  return null;
}

function cameraDistance(spec: RenderSpec, aspect = 1.6) {
  const tanHalfFov = Math.tan(24 * Math.PI / 180);
  let motifExtent = 0;
  if (spec.version === 2) {
    for (const motif of spec.motifs) {
      for (const stroke of motif.strokes) {
        for (const point of stroke.points) {
          motifExtent = Math.max(motifExtent, Math.hypot(...point) * spec.geometry.radius);
        }
      }
    }
  }
  // Keep the apparent size consistent across AI-selected radii. When an
  // unusually wide motif is present, pull back just enough to show it.
  const motifFit = motifExtent / (tanHalfFov * 0.9);
  const base = spec.geometry.mode === "hybrid"
    ? Math.max(4.5, spec.geometry.radius * 4.9, motifFit * 1.08)
    : Math.max(7.6, spec.geometry.radius * 4.75, motifFit);
  if (aspect >= 1.15) return base;

  // On narrow stages fit the foreground art horizontally, leaving the faint
  // farthest dust free to crop naturally instead of shrinking the whole planet.
  const cloudExtent = spec.geometry.radius *
    (spec.geometry.mode === "nebula" ? 2.15 : spec.geometry.mode === "hybrid" ? 1.75 : 1.55);
  const orbitExtent = spec.orbit.count > 0 ? spec.orbit.radius + 0.22 : 0;
  const extent = Math.max(cloudExtent, orbitExtent, motifExtent);
  const horizontalFit = extent / (tanHalfFov * Math.max(aspect, 0.55));
  return Math.max(base, horizontalFit);
}

export default function UniverseScene({ spec, sourceInput, burst, onShaderStatus }: UniverseSceneProps) {
  const frogRef = useRef<HTMLDivElement>(null);
  const symbolRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const frog = spec.version === 2 ? spec.frog : undefined;
  const accessories: FrogAccessory[] = frog && frog.accessory !== "none" ? [frog.accessory] : [];
  const symbols = spec.version === 2
    ? spec.symbols ?? deriveSymbolsFromInput(sourceInput, frog, spec.palette)
    : deriveSymbolsFromInput(sourceInput, undefined, spec.palette);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        key={`${spec.seed}:${spec.name}:${spec.geometry.mode}:${spec.geometry.radius}`}
        camera={{ position: [0, 0, cameraDistance(spec)], fov: 48, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        style={{ width: "100%", height: "100%", background: spec.palette.background }}
      >
        <color attach="background" args={[spec.palette.background]} />
        <CameraDistance spec={spec} />
        <Starfield seed={spec.seed} />
        <ParticlePlanet spec={spec} burst={burst} onShaderStatus={onShaderStatus} frogOverlay={frogRef} symbolOverlays={symbolRefs} />
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
      <div
        ref={frogRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          willChange: "transform, opacity",
          filter: `drop-shadow(0 0 10px ${frog?.accentColor ?? "#FFF2BC"}80)`,
        }}
      >
        <FrogCharacter accessories={accessories} badge={frog?.badgeText} />
      </div>
      {symbols.slice(0, 2).map((symbol, index) => (
        <div
          key={`${index}:${symbol.label}`}
          ref={symbolRefs[index]}
          style={{ position: "absolute", top: 0, left: 0, opacity: 0, pointerEvents: "none", willChange: "transform, opacity" }}
        >
          <SurfaceSymbolArt symbol={symbol} />
        </div>
      ))}
    </div>
  );
}
