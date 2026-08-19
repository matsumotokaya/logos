// What each picture stands on — the freehand art-direction layer.
//
// Third pass (2026-08-18, second material drop). The single-clip grounds of
// v6 looped two or three times per scene, and a loop's seam reads as a
// mistake. So a scene's ground is now a SEQUENCE: the clip plays once, then
// the film cuts to a still that carries the rest — the client's own
// direction ("1枚目は動画、2枚目3枚目は静止画").
//
// The brief (props.json) stays untouched. In template terms this module is
// what `take_inputs` would pin as materials.
//
// Two casting rules, both from this drop:
//  - CLIPS NEVER LOOP. A clip's weight is set so its slot ends before the
//    file does. Stills take the remaining time, moved by our Ken Burns —
//    which clips must never receive (they move themselves).
//  - VESSELS SAY 日本酒. The wine-glass tasting row is retired; the new
//    grounds hold ochoko, kikijoko (janome rings), tokkuri and masu. Sake is
//    colourless — anything amber was regenerated.

import type { GroundShot } from "./Ground";
import type { CameraMove } from "./Photo";

export interface SceneGround {
  kind: "sequence" | "image" | "video" | "collage";
  shots?: GroundShot[];
  src?: string;
  srcs?: string[];
  /** For single stills: the same casting controls a sequence shot carries. */
  focus?: { x: number; y: number };
  move?: CameraMove;
  grade?: string;
}

export const GROUNDS: Record<string, SceneGround> = {
  // The opening mark stands on the client-chosen black plaster wall with real
  // gold dust in it — 墨に金, photographed. The animated GoldDust settles onto
  // a ground that already believes it.
  logoIn: {
    kind: "image",
    src: "assets/photo/opening-wall.jpg",
    focus: { x: 0.6, y: 0.6 },
    move: { scaleFrom: 1.02, scaleTo: 1.08 },
  },

  // Title, ~10.5s: the pour (tokkuri → ochoko, plays once) — then the
  // stillness after it: the filled ochoko at rest beside the tokkuri.
  // Motion first, quiet second; the vertical title stands through both.
  // The clip is a 5.0s file but the slot ends at ~4.1s: after the first pour
  // it pours AGAIN, spilling (client: その尺はいらない). Measured by frame
  // extraction — first pour thins out by ~3.7s, the cup rests at 3.9–4.2s,
  // the second stream appears at ~4.4s. So the cut sits in the rest: the
  // pour completes, and the spill never happens.
  title: {
    kind: "sequence",
    shots: [
      {
        kind: "video",
        src: "assets/video/pour-ochoko.mp4",
        weight: 0.39,
        grade: "saturate(0.96)",
      },
      {
        kind: "image",
        src: "assets/photo/ochoko-brim.png",
        weight: 0.61,
        focus: { x: 0.35, y: 0.5 },
        move: { scaleFrom: 1.05, scaleTo: 1.14, xFrom: 0.6, xTo: -0.6 },
      },
    ],
  },

  // Value, ~15.4s: the drop (8s clip) — then the same indigo table a step
  // back, masu and guinomi in daylight graded down to the scene.
  value: {
    kind: "sequence",
    shots: [
      { kind: "video", src: "assets/video/drop.mp4", weight: 0.5, grade: "saturate(1.02)" },
      {
        kind: "image",
        src: "assets/photo/masu-guinomi.png",
        weight: 0.5,
        focus: { x: 0.55, y: 0.55 },
        move: { scaleFrom: 1.12, scaleTo: 1.04, xFrom: -0.8, xTo: 0.8 },
        grade: "brightness(0.82) saturate(0.9)",
      },
    ],
  },

  // 壱 tasting, ~14.5s: a hand raising the ochoko (clip, once) — the janome
  // rings from above — the tokkuri set. Porcelain instead of stemware: the
  // wine-glass row said "tasting", these say 利き酒.
  program0: {
    kind: "sequence",
    shots: [
      { kind: "video", src: "assets/video/ochoko-hold.mp4", weight: 0.34 },
      {
        kind: "image",
        src: "assets/photo/janome-top.png",
        weight: 0.33,
        focus: { x: 0.45, y: 0.45 },
        move: { scaleFrom: 1.06, scaleTo: 1.16 },
      },
      {
        kind: "image",
        src: "assets/photo/kikijoko-row.png",
        weight: 0.33,
        focus: { x: 0.6, y: 0.55 },
        move: { scaleFrom: 1.14, scaleTo: 1.05, xFrom: 0.8, xTo: -0.8 },
      },
    ],
  },

  // 弐 talk: the brewery's own press photography, tiled. Pans, no loop.
  program1: {
    kind: "collage",
    srcs: [
      "assets/photo/kv/kv_9.jpg",
      "assets/photo/kv/kv_4.jpg",
      "assets/photo/kv/kv_2.jpg",
      "assets/photo/kv/kv_10.jpg",
      "assets/photo/kv/kv_6.jpg",
      "assets/photo/kv/kv_8.jpg",
      "assets/photo/kv/kv_3.jpg",
      "assets/photo/kv/kv_11.jpg",
    ],
  },

  // 参 workshop, ~14.4s: hands writing notes (clip, once) — the held ochoko in
  // the same warm room — the tasting set. STAND-IN: this programme is Miss
  // SAKE's workshop and none of this is Miss SAKE material; it plays the part
  // until the real thing arrives (the client said so — replace, don't keep).
  program2: {
    kind: "sequence",
    shots: [
      { kind: "video", src: "assets/video/hands.mp4", weight: 0.34, grade: "brightness(0.9)" },
      {
        kind: "image",
        src: "assets/photo/ochoko-hold.png",
        weight: 0.33,
        focus: { x: 0.6, y: 0.5 },
        move: { scaleFrom: 1.04, scaleTo: 1.14 },
      },
      {
        kind: "image",
        src: "assets/photo/tasting-set.png",
        weight: 0.33,
        focus: { x: 0.5, y: 0.55 },
        move: { scaleFrom: 1.12, scaleTo: 1.04, xFrom: -0.6, xTo: 0.6 },
      },
    ],
  },

  // The close's invitation stands on a person actually tasting — the supplied
  // stock photograph that carried the CTA before the tasting-room render did.
  // The generated room said "venue"; the client chose the human moment.
  cta: {
    kind: "image",
    src: "assets/photo/closing-taster.jpg",
    focus: { x: 0.55, y: 0.38 },
    move: { scaleFrom: 1.04, scaleTo: 1.14, xFrom: 1.2, xTo: -0.6 },
    grade: "saturate(0.9) brightness(0.92)",
  },

  // The end card stands on Fuji above a sea of clouds, darkened until the
  // mark owns the frame.
  logoOut: { kind: "video", src: "assets/video/fuji-clouds.mp4" },
};

/** The workshop scene's picture-in-picture: the 2026 Miss SAKE finalists,
 *  from the association's own site (client request, 2026-08-19 — 「右上に
 *  ワイプで大きすぎず」). On screen while the narration says 2026 Miss SAKE
 *  2名とともに (≈1:00–1:10 of the film).
 *  Source: https://www.misssake.org/2026-miss-sake-japan-finalists/
 *  (2026集合写真23名, 2048×1152). */
export const PROGRAM2_WIPE = {
  src: "assets/photo/miss-sake-2026-finalists.jpg",
  /** Written under the frame so the inset names itself (client request). */
  caption: "2026 Miss SAKE",
} as const;

/** Unused supplied material, so the next session knows it was seen, not missed:
 *  tokyo-dusk.mp4 (skyline — outranked twice for the CTA), pour.mp4 (kiriko
 *  glass pour — outranked by the ochoko pour), five-glasses.png (stemware
 *  reads as wine), tasting-room.png (replaced by the human moment),
 *  autumn.png / sumi-ink.png / hands.png (held for the autumn insert),
 *  ミス酒2026京都完成.mp4 (source footage for the real program2, not a ground). */
