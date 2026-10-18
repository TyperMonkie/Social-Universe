"use client";

import { Component, ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Curve,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { Motif, RenderSpec } from "@/lib/contracts";

type Props = { spec: RenderSpec; burstAmount: React.RefObject<number> };

type PreparedStroke =
  | { primitive: "tube"; core: TubeGeometry; glow: TubeGeometry }
  | { primitive: "beads"; positions: Vector3[] };

function axisRotation(axis: Motif["axis"], angle: number): [number, number, number] {
  return axis === "x" ? [angle, 0, 0] : axis === "y" ? [0, angle, 0] : [0, 0, angle];
}

/** Project both controls and interpolated points above the particle surface. */
class SurfaceCurve extends Curve<Vector3> {
  private readonly source: CatmullRomCurve3;
  private readonly minimumRadius: number;

  constructor(points: Motif["strokes"][number]["points"], closed: boolean, radius: number) {
    super();
    this.source = new CatmullRomCurve3(
      points.map(([x, y, z]) => new Vector3(x * radius, y * radius, z * radius)),
      closed,
      "centripetal",
    );
    this.minimumRadius = radius * 1.04;
  }

  getPoint(t: number, optionalTarget = new Vector3()): Vector3 {
    const point = this.source.getPoint(t, optionalTarget);
    const length = point.length();
    if (length < 0.0001) return point.set(0, this.minimumRadius, 0);
    if (length < this.minimumRadius) point.multiplyScalar(this.minimumRadius / length);
    return point;
  }
}

function prepareStrokes(motif: Motif, radius: number): PreparedStroke[] {
  return motif.strokes.flatMap<PreparedStroke>((stroke) => {
    try {
      const curve = new SurfaceCurve(stroke.points, stroke.closed, radius);
      const segments = Math.min(112, Math.max(24, stroke.points.length * 8));
      if (stroke.primitive === "tube") {
        const width = Math.max(radius * motif.width, 0.0025);
        return [{
          primitive: "tube" as const,
          core: new TubeGeometry(curve, segments, width, 5, stroke.closed),
          glow: new TubeGeometry(curve, segments, width * 2.25, 5, stroke.closed),
        }];
      }
      const count = Math.min(48, Math.max(14, stroke.points.length * 5));
      const positions = Array.from({ length: count }, (_, index) =>
        curve.getPointAt(index / (stroke.closed ? count : count - 1)).clone(),
      );
      return [{ primitive: "beads" as const, positions }];
    } catch {
      // A malformed optional decoration must never hide the main planet.
      return [];
    }
  });
}

function BeadPath({
  positions,
  radius,
  width,
  geometry,
  material,
}: {
  positions: Vector3[];
  radius: number;
  width: number;
  geometry: SphereGeometry;
  material: MeshBasicMaterial;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    const beadRadius = radius * width * 1.55;
    const scale = new Vector3(beadRadius, beadRadius, beadRadius);
    for (let index = 0; index < positions.length; index++) {
      const variation = 0.76 + (index % 5 === 0 ? 0.56 : 0);
      matrix.makeScale(scale.x * variation, scale.y * variation, scale.z * variation);
      matrix.setPosition(positions[index]);
      mesh.current.setMatrixAt(index, matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [positions, radius, width]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, positions.length]}
      frustumCulled={false}
      renderOrder={4}
      dispose={null}
    />
  );
}

function MotifFigure({ motif, radius, burstAmount }: {
  motif: Motif;
  radius: number;
  burstAmount: React.RefObject<number>;
}) {
  const group = useRef<Group>(null);
  const materials = useRef<{ core: MeshBasicMaterial; glow: MeshBasicMaterial } | null>(null);
  const strokes = useMemo(() => prepareStrokes(motif, radius), [motif, radius]);
  const beadGeometry = useMemo(() => new SphereGeometry(1, 7, 5), []);
  const coreMaterial = useMemo(() => new MeshBasicMaterial({
    color: motif.color,
    transparent: true,
    opacity: motif.opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  }), [motif.color, motif.opacity]);
  const glowMaterial = useMemo(() => new MeshBasicMaterial({
    color: motif.color,
    transparent: true,
    opacity: motif.opacity * 0.17,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  }), [motif.color, motif.opacity]);

  useEffect(() => {
    materials.current = { core: coreMaterial, glow: glowMaterial };
    return () => {
      materials.current = null;
      coreMaterial.dispose();
      glowMaterial.dispose();
    };
  }, [coreMaterial, glowMaterial]);
  useEffect(() => () => {
    strokes.forEach((stroke) => {
      if (stroke.primitive === "tube") {
        stroke.core.dispose();
        stroke.glow.dispose();
      }
    });
  }, [strokes]);
  useEffect(() => () => beadGeometry.dispose(), [beadGeometry]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const burst = burstAmount.current ?? 0;
    if (group.current) {
      const rotation = axisRotation(motif.axis, motif.motion.phase + time * motif.motion.spin);
      group.current.rotation.set(...rotation);
      group.current.scale.setScalar(
        (1 + Math.sin(time * 0.75 + motif.motion.phase) * motif.motion.breathe) * (1 + burst * 0.18),
      );
    }
    if (materials.current) {
      const shimmer = 1 - 0.16 * motif.motion.shimmer +
        0.16 * motif.motion.shimmer * Math.sin(time * 2.1 + motif.motion.phase);
      const visibility = Math.max(0.12, 1 - burst * 0.83);
      materials.current.core.opacity = motif.opacity * shimmer * visibility;
      materials.current.glow.opacity = motif.opacity * 0.17 * shimmer * visibility;
    }
  });

  if (strokes.length === 0) return null;
  return (
    <group ref={group} dispose={null}>
      {Array.from({ length: motif.copies }, (_, copyIndex) => (
        <group key={copyIndex} rotation={axisRotation(motif.axis, copyIndex * Math.PI * 2 / motif.copies)}>
          {strokes.map((stroke, strokeIndex) => stroke.primitive === "tube" ? (
            <group key={strokeIndex}>
              <mesh geometry={stroke.glow} material={glowMaterial} renderOrder={3} dispose={null} />
              <mesh geometry={stroke.core} material={coreMaterial} renderOrder={4} dispose={null} />
            </group>
          ) : (
            <BeadPath
              key={strokeIndex}
              positions={stroke.positions}
              radius={radius}
              width={motif.width}
              geometry={beadGeometry}
              material={coreMaterial}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

class MotifErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function MotifLayer({ spec, burstAmount }: Props) {
  if (spec.version !== 2 || spec.motifs.length === 0) return null;
  return (
    <MotifErrorBoundary key={JSON.stringify(spec.motifs)}>
      <group>
        {spec.motifs.map((motif, index) => (
          <MotifFigure key={`${index}-${motif.label}`} motif={motif} radius={spec.geometry.radius} burstAmount={burstAmount} />
        ))}
      </group>
    </MotifErrorBoundary>
  );
}
