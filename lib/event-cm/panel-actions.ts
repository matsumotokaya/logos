import type { EventCmBrief, EventCmSceneRole } from "@/remotion/event-cm/types";

// What you can do to one picture of the film, and what to say when you cannot.
//
// Same shape as lib/brand-tree-actions.ts, and for the same reason: the answer
// is a rule about the template, so it lives next to the template rather than
// inside a button. A menu is not the authority — the server applies the same
// function before writing anything, and it decides what removing a picture
// MEANS as well as whether it is allowed (app/api/brands/[id]/videos/[videoId]/
// panels/route.ts). The client used to compose that write itself, which made
// the button a second author of briefs.
//
// Deleting a picture is not a generic operation here. This template's structure
// is fixed and says so (remotion/event-cm/types.ts EVENT_CM_SCENES): the film
// opens and closes on the presenter's mark, names itself, says why to come, says
// what happens, and says what to do. A picture is removable only when its
// absence is a shape the film already has:
//
//   the speakers   — the scene exists because speakers were announced, and
//                    disappears when they are switched off. Reversible.
//   one programme  — each programme has its own picture, so removing the
//                    programme removes the picture. Destructive to the list.
//
// Everything else would leave an empty frame rather than one fewer frame, and
// calling that "delete" would be a lie. So those say why instead.

export type PanelDeletion =
  | {
      can: true;
      /** Switch a field off: the value stays, the picture goes. */
      kind: "suppress";
      path: string;
      confirm: string;
    }
  | {
      can: true;
      /** Take one programme out of the list. The picture goes with it. */
      kind: "remove-program";
      index: number;
      confirm: string;
    }
  | { can: false; reason: string };

const FIXED: Partial<Record<EventCmSceneRole, string>> = {
  logoIn: "提供のマークは外せません。最初と最後のコマは「誰の動画か」を言う場所です",
  logoOut: "提供のマークは外せません。最初と最後のコマは「誰の動画か」を言う場所です",
  title: "タイトルのコマは外せません。告知は自分の名前を先に言います",
  value: "価値のコマは外せません。来る理由の無い告知になります",
  cta: "日程・申し込みのコマは外せません。見た人が次にできることが無くなります",
};

export function panelDeletion(
  brief: EventCmBrief,
  panel: { role: EventCmSceneRole; index?: number },
): PanelDeletion {
  if (panel.role === "guests") {
    return {
      can: true,
      kind: "suppress",
      path: "guests",
      confirm: "登壇者のコマを削除します。登壇者の情報は残るので、あとで戻せます",
    };
  }

  if (panel.role === "program") {
    // The last programme keeps its picture: the programme scene is part of the
    // structure, so removing the final item would leave the frame standing with
    // nothing in it. Editing the text is the operation that case wants.
    if (brief.programs.length <= 1 || panel.index === undefined) {
      return {
        can: false,
        reason:
          "プログラムのコマは1つ残ります。内容はこのコマで直せます（プログラムが2つ以上あるときは、1つずつ削除できます）",
      };
    }
    return {
      can: true,
      kind: "remove-program",
      index: panel.index,
      confirm: `「${brief.programs[panel.index]?.title ?? ""}」をプログラムから削除します`,
    };
  }

  return { can: false, reason: FIXED[panel.role] ?? "このコマは削除できません" };
}
