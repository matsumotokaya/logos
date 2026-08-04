// Slot inventory for an EventBrief: what is carried by a real asset, what is
// standing on a designed fallback, and which facts are deliberately omitted.
//
// This is deliberately NOT a completion score. slide-factory counts unresolved
// XXX because a deck with blanks is unfinished; here the video is finished
// either way — a slot on its fallback is a design decision, not a defect. So
// the states are descriptive ("what is this slot currently standing on"),
// never a pass/fail, and the UI must not present them as errors.

import type { EventBrief } from "./types";

export type SlotState =
  /** A real asset file is wired in. */
  | "asset"
  /** No asset: the composition renders its designed substitute. */
  | "fallback"
  /** A fact that isn't confirmed yet, so it is left off screen entirely. */
  | "omitted";

export interface SlotStatus {
  /** Stable id, usable later as the editing UI's target. */
  id: string;
  label: string;
  state: SlotState;
  /** What the viewer actually sees right now. */
  detail: string;
}

export interface SlotGroup {
  label: string;
  slots: SlotStatus[];
}

const assetName = (src: string): string => src.split("/").pop() ?? src;

export function briefSlots(brief: EventBrief): SlotGroup[] {
  return [
    {
      label: "ロゴ",
      slots: brief.logos.map((logo, i) => ({
        id: `logo.${i}`,
        label: logo.name,
        state: logo.src ? ("asset" as const) : ("fallback" as const),
        detail: logo.src
          ? `${assetName(logo.src)}${logo.treatment === "invert" ? "（実行時に反転）" : ""}`
          : "明朝のクレジット表記で代替",
      })),
    },
    {
      label: "ゲスト",
      slots: brief.guests.map((guest, i) => ({
        id: `guest.${i}`,
        label: guest.name,
        state: guest.photo ? ("asset" as const) : ("fallback" as const),
        detail: guest.photo
          ? `${assetName(guest.photo.src)}（焦点指定でメダリオン中央へ）`
          : "姓一文字の金縁モノグラムで代替",
      })),
    },
    {
      label: "シーン映像",
      slots: [
        {
          id: "visuals.inkArt",
          label: "タイトル裏の墨書",
          ...photoSlot(brief.visuals.inkArt, "墨背景と金粒子のみで成立"),
        },
        {
          id: "visuals.value",
          label: "価値提示の全面写真",
          ...photoSlot(brief.visuals.value?.src ?? null, "墨背景と金粒子のみで成立"),
        },
        {
          id: "visuals.programs",
          label: "プログラム背景",
          ...photoSlot(brief.visuals.programs?.src ?? null, "墨背景と金粒子のみで成立"),
        },
        {
          id: "visuals.closing",
          label: "クロージング背景",
          ...photoSlot(brief.visuals.closing?.src ?? null, "墨背景と金粒子のみで成立"),
        },
        {
          id: "visuals.texture",
          label: "オープニングの質感",
          ...photoSlot(brief.visuals.texture, "グラデーションのみで成立"),
        },
      ],
    },
    {
      label: "音",
      slots: [
        {
          id: "bgm",
          label: "BGM",
          ...photoSlot(brief.bgm, "無音で書き出し（後から差し込み可）"),
        },
      ],
    },
    {
      label: "確定情報",
      slots: [
        {
          id: "schedule.datetime",
          label: "日時",
          state: "asset",
          detail: `${brief.schedule.date} ${brief.schedule.weekday} ${brief.schedule.time}`,
        },
        {
          id: "schedule.venue",
          label: "会場",
          ...factSlot(brief.schedule.venue),
        },
        {
          id: "schedule.fee",
          label: "参加費",
          ...factSlot(brief.schedule.fee),
        },
      ],
    },
  ];
}

const photoSlot = (src: string | null, fallback: string) =>
  src
    ? { state: "asset" as const, detail: assetName(src) }
    : { state: "fallback" as const, detail: fallback };

/** Facts are never invented: an unknown one leaves the screen rather than
 *  showing a placeholder, so its state is "omitted", not "fallback". */
const factSlot = (value: string | null) =>
  value
    ? { state: "asset" as const, detail: value }
    : { state: "omitted" as const, detail: "未確定のため画面から省略中" };
