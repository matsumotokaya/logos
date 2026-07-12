"use client";

// 012 Extrude Turntable — the mark as a solid object on a slow turntable.
//
// SVG paths are extruded into 3D and rotated at a constant, unhurried pace.
// Dignity comes from the material and light, not speed: a matte surface, a
// soft key light and gentle fill, a plain white studio. SVG only.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentProps } from "@/labs/motion/core/experiment-api";
import { buildLogoExtrusion, disposeGroup } from "@/labs/motion/core/three-utils";

const START_Y = -0.35;

function Mark({
  logo,
  playingRef,
  replayNonce,
}: {
  logo: ExperimentProps["logo"];
  playingRef: React.RefObject<boolean>;
  replayNonce: number;
}) {
  const group = useMemo(() => buildLogoExtrusion(logo), [logo]);
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    if (ref.current) ref.current.rotation.y = START_Y;
  }, [replayNonce, logo]);

  useEffect(() => () => disposeGroup(group), [group]);

  useFrame((_, dt) => {
    if (ref.current && playingRef.current) {
      // ~20s per revolution.
      ref.current.rotation.y += dt * ((Math.PI * 2) / 20);
    }
  });

  return (
    <group ref={ref} rotation={[0, START_Y, 0]}>
      <primitive object={group} />
    </group>
  );
}

export default function ExtrudeTurntable({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  if (!logo.svg) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-sm text-ink-muted">
        押し出しには SVG ロゴが必要です
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <Canvas
        camera={{ position: [0, 0.15, 4.2], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 5, 4]} intensity={1.25} />
        <directionalLight position={[-4, 1, -2]} intensity={0.35} />
        <Mark logo={logo} playingRef={playingRef} replayNonce={replayNonce} />
      </Canvas>
    </div>
  );
}
