import {
  CATEGORY_LABELS,
  type Template2D,
  type TemplateCategory,
} from "@/labs/workflow/core/template-format";
import {
  getWorkflowDefaultMappings,
  getWorkflowPresentationPlacements,
  getWorkflowPresentationScene,
} from "@/labs/workflow/core/presentation-placement";
import type {
  PresentationAssetDefinitionCommon,
  PresentationPlacementId,
  ResolvedPresentationAsset,
} from "@/lib/presentation-schema";
import type { PresentationScene } from "@/lib/presentation-scenes";

export type BuiltinMockupKind =
  | "social-card"
  | "staff-badge"
  | "tshirt"
  | "generated-mug"
  | "generated-tote"
  | "generated-cap";

type PresentationMockupCommon = PresentationAssetDefinitionCommon & {
  scene: PresentationScene;
  templateCategory: TemplateCategory;
  category: string;
  presentationAdopted: boolean;
  presentationOrder: number;
};

export type BuiltinPresentationMockup = PresentationMockupCommon & {
  kind: "builtin";
  builtinKind: BuiltinMockupKind;
};

export type TemplatePresentationMockup = PresentationMockupCommon & {
  kind: "template";
  template: Template2D;
};

export type PresentationMockupDefinition =
  | BuiltinPresentationMockup
  | TemplatePresentationMockup;

export const BUILTIN_PRESENTATION_MOCKUPS: BuiltinPresentationMockup[] = [
  {
    id: "social-card",
    assetKind: "mockup",
    kind: "builtin",
    builtinKind: "social-card",
    title: "プロフィールカード",
    scene: "social",
    templateCategory: "screen",
    category: "スクリーン",
    sourceLab: "workflow",
    allowedPlacements: ["social.primary"],
    defaultMappings: [defaultMapping("social.primary", 10, true)],
    notesJa: "現行プレゼンの Social セクション実装。ブランドカラーのバナー、認証バッジ、プロフィール写真を含む固定モックアップ。",
    impressions: ["公式", "親しみ"],
    presentationAdopted: true,
    presentationOrder: 10,
  },
  {
    id: "staff-badge",
    assetKind: "mockup",
    kind: "builtin",
    builtinKind: "staff-badge",
    title: "社員証",
    scene: "onsite",
    templateCategory: "signage",
    category: "サイネージ",
    sourceLab: "workflow",
    allowedPlacements: ["onsite.primary"],
    defaultMappings: [defaultMapping("onsite.primary", 10, true)],
    notesJa: "現行プレゼンの On-site セクション実装。ダーク化したブランドカラー面に白抜きロゴを配置したラニヤード付き社員証。",
    impressions: ["業務", "現場"],
    presentationAdopted: true,
    presentationOrder: 10,
  },
  {
    id: "tshirt-white",
    assetKind: "mockup",
    kind: "builtin",
    builtinKind: "tshirt",
    title: "Tシャツ",
    scene: "merch",
    templateCategory: "fabric",
    category: "ファブリック",
    sourceLab: "workflow",
    allowedPlacements: ["merch.primary"],
    defaultMappings: [defaultMapping("merch.primary", 10, true)],
    notesJa: "現行プレゼンの Merchandise セクション実装。白Tシャツの胸中央にロゴを multiply 合成する固定モックアップ。",
    impressions: ["定番", "アパレル"],
    presentationAdopted: true,
    presentationOrder: 10,
  },
  {
    id: "mug",
    assetKind: "generated",
    kind: "builtin",
    builtinKind: "generated-mug",
    title: "マグカップ",
    scene: "generated",
    templateCategory: "product",
    category: "プロダクト",
    sourceLab: "generative",
    allowedPlacements: ["generated.tile"],
    defaultMappings: [defaultMapping("generated.tile", 10, true)],
    notesJa: "Gemini API で手動生成する写実モックアップ。生成結果はロゴ候補単位でキャッシュされる。",
    impressions: ["写実", "物販"],
    presentationAdopted: true,
    presentationOrder: 10,
  },
  {
    id: "tote",
    assetKind: "generated",
    kind: "builtin",
    builtinKind: "generated-tote",
    title: "トートバッグ",
    scene: "generated",
    templateCategory: "product",
    category: "プロダクト",
    sourceLab: "generative",
    allowedPlacements: ["generated.tile"],
    defaultMappings: [defaultMapping("generated.tile", 20, true)],
    notesJa: "Gemini API で手動生成する写実モックアップ。生成結果はロゴ候補単位でキャッシュされる。",
    impressions: ["写実", "物販"],
    presentationAdopted: true,
    presentationOrder: 20,
  },
  {
    id: "cap",
    assetKind: "generated",
    kind: "builtin",
    builtinKind: "generated-cap",
    title: "キャップ",
    scene: "generated",
    templateCategory: "product",
    category: "プロダクト",
    sourceLab: "generative",
    allowedPlacements: ["generated.tile"],
    defaultMappings: [defaultMapping("generated.tile", 30, true)],
    notesJa: "Gemini API で手動生成する写実モックアップ。生成結果はロゴ候補単位でキャッシュされる。",
    impressions: ["写実", "物販"],
    presentationAdopted: true,
    presentationOrder: 30,
  },
];

export function getBuiltinPresentationMockup(id: string) {
  return BUILTIN_PRESENTATION_MOCKUPS.find((entry) => entry.id === id);
}

export function templateToPresentationMockup(
  template: Template2D,
): TemplatePresentationMockup {
  const scene = getWorkflowPresentationScene(template);
  const allowedPlacements = getWorkflowPresentationPlacements(template);
  const defaultMappings = getWorkflowDefaultMappings(template);
  return {
    id: template.id,
    kind: "template",
    template,
    title: template.nameJa,
    assetKind: "mockup",
    scene,
    templateCategory: template.category,
    category: CATEGORY_LABELS[template.category],
    sourceLab: "workflow",
    allowedPlacements,
    defaultMappings,
    notesJa: template.notesJa ?? "",
    impressions: template.impressions,
    presentationAdopted: defaultMappings.some((mapping) => mapping.enabled),
    presentationOrder:
      defaultMappings.reduce(
        (min, mapping) => Math.min(min, mapping.order),
        Number.MAX_SAFE_INTEGER,
      ) ?? Number.MAX_SAFE_INTEGER,
  };
}

export function comparePresentationMockups(
  a: PresentationMockupDefinition,
  b: PresentationMockupDefinition,
) {
  return (
    a.presentationOrder - b.presentationOrder ||
    a.title.localeCompare(b.title, "ja")
  );
}

export type ResolvedPresentationMockup = ResolvedPresentationAsset<PresentationMockupDefinition>;

function defaultMapping(
  placementId: PresentationPlacementId,
  order: number,
  enabled: boolean,
) {
  return {
    placementId,
    order,
    enabled,
  };
}
