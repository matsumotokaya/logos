"use client";

// 013 Material Study — the same mark, three surfaces: metal, glass, ceramic.
//
// One extruded mark cycles slowly through metal / glass / ceramic material
// parameters, cross-faded by lerping MeshPhysicalMaterial properties over
// time (not by swapping material instances). A gentle, constant rotation
// keeps the form legible. Reflections come from an in-scene environment map
// built purely from drei <Lightformer> panels — no preset, no HDR file, so
// this keeps working offline/behind CSP. SVG only.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentProps } from "@/labs/motion/core/experiment-api";
import { buildLogoExtrusion, disposeGroup } from "@/labs/motion/core/three-utils";

const START_Y = -0.35;

type MaterialStyleKey = "metal" | "glass" | "ceramic";

type MaterialStyleParams = {
  metalness: number;
  roughness: number;
  transmission: number;
  thickness: number;
  ior: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  /** 0 = pure logo colour, 1 = pure white. */
  colorMix: number;
};

// Keep transmission/clearcoat just above zero at all times (never exactly 0)
// so the shader's USE_TRANSMISSION / USE_CLEARCOAT defines stay compiled in
// from the very first frame — otherwise a material created "metal-first"
// would never grow those features when it lerps toward glass/ceramic.
const STYLES: Record<MaterialStyleKey, MaterialStyleParams> = {
  metal: {
    metalness: 1,
    roughness: 0.2,
    transmission: 0.001,
    thickness: 0.05,
    ior: 1.5,
    clearcoat: 0.001,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
    colorMix: 0.1,
  },
  glass: {
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 1.4,
    ior: 1.4,
    clearcoat: 0.001,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.1,
    colorMix: 0.82,
  },
  ceramic: {
    metalness: 0,
    roughness: 0.42,
    transmission: 0.001,
    thickness: 0.05,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.9,
    colorMix: 0.72,
  },
};

const ORDER: MaterialStyleKey[] = ["metal", "glass", "ceramic"];
const HOLD = 2.2; // seconds fully settled on a style
const TRANS = 0.8; // seconds crossfading into the next style
const PHASE = HOLD + TRANS; // ~3s per style, matches the brief
const CYCLE = PHASE * ORDER.length;

const WHITE = new THREE.Color("#ffffff");

/** Smoothstep ease — no linear cross-fades. */
function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Mutate a material's physical params toward a blend of two named styles. */
function applyStyleBlend(
  material: THREE.MeshPhysicalMaterial,
  baseColor: THREE.Color,
  fromKey: MaterialStyleKey,
  toKey: MaterialStyleKey,
  t: number,
): void {
  const from = STYLES[fromKey];
  const to = STYLES[toKey];
  material.metalness = lerpNum(from.metalness, to.metalness, t);
  material.roughness = lerpNum(from.roughness, to.roughness, t);
  material.transmission = lerpNum(from.transmission, to.transmission, t);
  material.thickness = lerpNum(from.thickness, to.thickness, t);
  material.ior = lerpNum(from.ior, to.ior, t);
  material.clearcoat = lerpNum(from.clearcoat, to.clearcoat, t);
  material.clearcoatRoughness = lerpNum(
    from.clearcoatRoughness,
    to.clearcoatRoughness,
    t,
  );
  material.envMapIntensity = lerpNum(
    from.envMapIntensity,
    to.envMapIntensity,
    t,
  );
  const colorMix = lerpNum(from.colorMix, to.colorMix, t);
  material.color.copy(baseColor).lerp(WHITE, colorMix);
}

function Mark({
  logo,
  playingRef,
  replayNonce,
}: {
  logo: ExperimentProps["logo"];
  playingRef: React.RefObject<boolean>;
  replayNonce: number;
}) {
  const group = useMemo(
    () =>
      buildLogoExtrusion(logo, {
        material: (color) => {
          const start = STYLES.metal;
          const material = new THREE.MeshPhysicalMaterial({
            color,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            metalness: start.metalness,
            roughness: start.roughness,
            transmission: start.transmission,
            thickness: start.thickness,
            ior: start.ior,
            clearcoat: start.clearcoat,
            clearcoatRoughness: start.clearcoatRoughness,
            envMapIntensity: start.envMapIntensity,
          });
          material.userData.baseColor = color.clone();
          material.needsUpdate = true;
          return material;
        },
      }),
    [logo],
  );

  const ref = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (ref.current) ref.current.rotation.y = START_Y;
    elapsedRef.current = 0;
  }, [replayNonce, logo]);

  useEffect(() => () => disposeGroup(group), [group]);

  useFrame((_, dt) => {
    if (playingRef.current) {
      elapsedRef.current += dt;
      if (ref.current) {
        // ~48s per revolution — slow enough that material stays the focus.
        ref.current.rotation.y += dt * ((Math.PI * 2) / 48);
      }
    }

    const t = elapsedRef.current % CYCLE;
    const phaseIndex = Math.floor(t / PHASE);
    const phaseT = t - phaseIndex * PHASE;
    const fromKey = ORDER[phaseIndex % ORDER.length];
    const toKey = ORDER[(phaseIndex + 1) % ORDER.length];
    const frac = phaseT < HOLD ? 0 : ease((phaseT - HOLD) / TRANS);

    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      const baseColor = material.userData?.baseColor as
        | THREE.Color
        | undefined;
      if (!baseColor) return;
      applyStyleBlend(material, baseColor, fromKey, toKey, frac);
    });
  });

  return (
    <group ref={ref} rotation={[0, START_Y, 0]}>
      <primitive object={group} />
    </group>
  );
}

export default function MaterialStudy({
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
        質感比較には SVG ロゴが必要です
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <Canvas
        camera={{ position: [0, 0.2, 4.4], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        {/* No preset / files — this app runs offline behind a strict CSP,
            so the environment map is assembled from in-scene Lightformers. */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#ffffff"
            scale={[9, 9, 1]}
            position={[0, 6, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#ffffff"
            scale={[3, 8, 1]}
            position={[-6, 1, 3]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#ffffff"
            scale={[3, 8, 1]}
            position={[6, 1, 3]}
            rotation={[0, -Math.PI / 2, 0]}
          />
          <Lightformer
            form="ring"
            intensity={0.5}
            color="#ffffff"
            scale={[5, 5, 1]}
            position={[0, -2, -3]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </Environment>
        <Mark logo={logo} playingRef={playingRef} replayNonce={replayNonce} />
      </Canvas>
    </div>
  );
}
