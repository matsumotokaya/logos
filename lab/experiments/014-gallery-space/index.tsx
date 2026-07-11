"use client";

// 014 Gallery Space — the mark as a framed print on a museum wall.
//
// The logo is baked into a white-matted CanvasTexture (clear space enforced
// at bake time, not just in CSS) and mounted behind a thin frame on a neutral
// gallery wall. The camera performs a slow, eased dolly-in/dolly-out toward
// the frame so the room reads as calm and the mark stays the subject.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExperimentProps, LabLogo } from "@/lab/core/experiment-api";
import { logoToImage } from "@/lab/core/svg-utils";

// ---- scene tuning ----
const CANVAS_SIZE = 1024;
/** Lab guardrail: the logo must fit inside a 62% box, centered, contain-fit. */
const CLEAR_SPACE_RATIO = 0.62;
const ART_SCALE = 2.3; // world units for the print's longer side
const FRAME_T = 0.16; // frame bar width
const FRAME_DEPTH = 0.1; // frame bar depth (protrudes toward the viewer)
const FRAME_OVERLAP = 0.05; // how far the frame laps onto the mat, hiding its edge
const ART_Y = 1.55; // wall-mounted height (roughly eye level)
const CYCLE = 12; // seconds for one direction of the dolly
const DOLLY_START_Z = 6.4;
const DOLLY_END_Z = 3.1;
const TRUCK_AMOUNT = 0.4; // subtle lateral drift alongside the dolly

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Bake a logo onto a white mat, respecting the clear-space guardrail. */
function buildMatCanvas(
  img: HTMLImageElement,
  viewBox: { w: number; h: number },
): { canvas: HTMLCanvasElement; w: number; h: number } {
  const rawAspect =
    viewBox.w > 0 && viewBox.h > 0
      ? viewBox.w / viewBox.h
      : img.naturalWidth / img.naturalHeight || 1;
  const aspect = Math.min(1.6, Math.max(0.62, rawAspect));
  const w = aspect >= 1 ? CANVAS_SIZE : Math.round(CANVAS_SIZE * aspect);
  const h = aspect >= 1 ? Math.round(CANVAS_SIZE / aspect) : CANVAS_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, w, h };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const boxW = w * CLEAR_SPACE_RATIO;
  const boxH = h * CLEAR_SPACE_RATIO;
  const imgAspect = img.naturalWidth / img.naturalHeight || 1;
  let drawW = boxW;
  let drawH = boxW / imgAspect;
  if (drawH > boxH) {
    drawH = boxH;
    drawW = boxH * imgAspect;
  }
  ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);

  return { canvas, w, h };
}

type FramedTexture = { texture: THREE.CanvasTexture; w: number; h: number };

/** Decode the logo, bake it into a matted texture, and dispose it on change/unmount. */
function useFramedTexture(logo: LabLogo): FramedTexture | null {
  const [state, setState] = useState<FramedTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ownTexture: THREE.CanvasTexture | null = null;

    logoToImage(logo)
      .then((img) => {
        if (cancelled) return;
        const { canvas, w, h } = buildMatCanvas(img, logo.viewBox);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.needsUpdate = true;
        ownTexture = texture;
        setState({ texture, w, h });
      })
      .catch(() => {
        // Leave state untouched; the frame simply stays empty rather than crashing.
      });

    return () => {
      cancelled = true;
      ownTexture?.dispose();
    };
  }, [logo]);

  return state;
}

type Bar = { pos: [number, number, number]; size: [number, number, number] };

function Artwork({ logo }: { logo: LabLogo }) {
  const framed = useFramedTexture(logo);
  const maxDim = framed ? Math.max(framed.w, framed.h) : 1;
  const worldW = framed ? (framed.w / maxDim) * ART_SCALE : ART_SCALE;
  const worldH = framed ? (framed.h / maxDim) * ART_SCALE : ART_SCALE;

  const bars: Bar[] = useMemo(() => {
    const outerW = worldW + (FRAME_T - FRAME_OVERLAP) * 2;
    const outerH = worldH + (FRAME_T - FRAME_OVERLAP) * 2;
    const edgeY = worldH / 2 + FRAME_T / 2 - FRAME_OVERLAP;
    const edgeX = worldW / 2 + FRAME_T / 2 - FRAME_OVERLAP;
    return [
      { pos: [0, edgeY, 0], size: [outerW, FRAME_T, FRAME_DEPTH] }, // top
      { pos: [0, -edgeY, 0], size: [outerW, FRAME_T, FRAME_DEPTH] }, // bottom
      { pos: [-edgeX, 0, 0], size: [FRAME_T, outerH, FRAME_DEPTH] }, // left
      { pos: [edgeX, 0, 0], size: [FRAME_T, outerH, FRAME_DEPTH] }, // right
    ];
  }, [worldW, worldH]);

  return (
    <group position={[0, ART_Y, 0.015]}>
      {framed && (
        <mesh>
          <planeGeometry args={[worldW, worldH]} />
          <meshStandardMaterial map={framed.texture} roughness={0.9} metalness={0} />
        </mesh>
      )}
      <group position={[0, 0, FRAME_DEPTH / 2]}>
        {bars.map((bar, i) => (
          <mesh key={i} position={bar.pos}>
            <boxGeometry args={bar.size} />
            <meshStandardMaterial color="#20201f" roughness={0.45} metalness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function CameraRig({
  playingRef,
  replayNonce,
}: {
  playingRef: React.RefObject<boolean>;
  replayNonce: number;
}) {
  const elapsed = useRef(0);

  useEffect(() => {
    elapsed.current = 0;
  }, [replayNonce]);

  useFrame(({ camera }, dt) => {
    if (playingRef.current) elapsed.current += dt;
    // Ping-pong: forward for CYCLE seconds, then back for CYCLE seconds.
    const phase = elapsed.current % (CYCLE * 2);
    const t = phase < CYCLE ? phase / CYCLE : 2 - phase / CYCLE;
    const eased = easeInOutCubic(t);
    const z = THREE.MathUtils.lerp(DOLLY_START_Z, DOLLY_END_Z, eased);
    const x = THREE.MathUtils.lerp(-TRUCK_AMOUNT, TRUCK_AMOUNT, eased);
    camera.position.set(x, ART_Y + 0.05, z);
    camera.lookAt(0, ART_Y, 0);
  });

  return null;
}

function GalleryScene({
  logo,
  playingRef,
  replayNonce,
}: {
  logo: LabLogo;
  playingRef: React.RefObject<boolean>;
  replayNonce: number;
}) {
  const spotTarget = useMemo(() => new THREE.Object3D(), []);

  return (
    <>
      <color attach="background" args={["#efeeea"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-4, 5, 3]} intensity={0.4} />
      <spotLight
        position={[0.6, 4.4, 3.2]}
        angle={0.4}
        penumbra={0.7}
        intensity={3.2}
        distance={14}
        decay={1.4}
        color="#fff6ea"
        target={spotTarget}
      />
      <primitive object={spotTarget} position={[0, ART_Y, 0]} />

      {/* back wall */}
      <mesh position={[0, 2, 0]}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#f4f3ef" roughness={1} />
      </mesh>

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 3]}>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color="#dedad3" roughness={1} />
      </mesh>

      <Artwork logo={logo} />
      <CameraRig playingRef={playingRef} replayNonce={replayNonce} />
    </>
  );
}

export default function GallerySpace({ logo, playing, replayNonce }: ExperimentProps) {
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  if (!logo.svg && !logo.pngDataUri) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-sm text-ink-muted">
        表示できるロゴデータがありません
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <Canvas
        camera={{ position: [0, ART_Y + 0.05, DOLLY_START_Z], fov: 38 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <GalleryScene logo={logo} playingRef={playingRef} replayNonce={replayNonce} />
      </Canvas>
    </div>
  );
}
