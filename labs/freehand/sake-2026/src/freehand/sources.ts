// What each picture stands on — the freehand art-direction layer.
//
// The brief (props.json) stays untouched: it still owns every word, every
// fact, and the portraits. What this file owns is the GROUND each scene is
// staged on, using the material supplied on 2026-08-18 (generated stills and
// clips from ASSET-PROMPTS.md, two stock landscape clips, and 〆張鶴's own
// press photography).
//
// In template terms this is what `take_inputs` would pin as materials; here it
// is a module so the experiment can move fast. The mapping decisions worth
// keeping are written next to each slot.
//
// One rule carried over from ASSET-PROMPTS.md, inverted: the generated clips
// hold the camera still because OUR layer moves it — so on video grounds our
// layer must NOT move (a clip that pans under our push-in reads as drift).
// Stills keep the Ken Burns; clips play locked-off.

export interface GroundSource {
  kind: "video" | "image" | "collage";
  src?: string;
  srcs?: string[];
}

export const GROUNDS: Record<string, GroundSource> = {
  // The pour, actually pouring. 832×464 upscaled ~2.3× — soft, but the frame
  // is mostly darkness and the grain layer reads as intent. Motion beats
  // resolution on a hero; revisit when a 1080p take of V1 exists.
  title: { kind: "video", src: "assets/video/pour.mp4" },

  // The drop and its ripple, endlessly. 8s and it loops without a visible seam
  // because the surface returns to rest between drops.
  value: { kind: "video", src: "assets/video/drop.mp4" },

  // 壱 tasting: five glasses, five shades — the one line the photography could
  // never say before. Generated exactly to the prompt: dark left half for the
  // text, glasses glowing right.
  program0: { kind: "image", src: "assets/photo/five-glasses.png" },

  // 弐 talk: the brewery itself. Eight of 〆張鶴's own press photographs as a
  // tiled wall — the client's suggestion, and the right one: a talk about the
  // brewery backed by generated imagery would be a strange lie when the real
  // 麹, the real noren and the real tanks are on file.
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

  // 参 workshop: hands tasting and taking notes. Loops ~2.6× over the scene;
  // the motion is repetitive enough that the loop reads as continuity.
  program2: { kind: "video", src: "assets/video/hands.mp4" },

  // The room the date is inviting people into: set tables, empty chairs, city
  // at blue hour. Replaces the smelling-man photograph, which said "sake" but
  // never "you are invited somewhere".
  cta: { kind: "image", src: "assets/photo/tasting-room.png" },

  // The end card stands on Fuji above a sea of clouds, darkened until the mark
  // owns the frame — the client's own direction for this clip.
  logoOut: { kind: "video", src: "assets/video/fuji-clouds.mp4" },
};

/** Unused supplied material, so the next session knows it was seen, not missed:
 *  tokyo-dusk.mp4 (skyline timelapse — the tasting room says "venue" better),
 *  autumn.png / sumi-ink.png / hands.png (stills outranked by their clips),
 *  ミス酒2026京都完成.mp4 (21min ceremony recording — source footage, not a ground). */
