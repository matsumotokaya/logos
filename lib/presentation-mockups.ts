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

export type RuntimePresentationMockup = PresentationMockupCommon & {
  kind: "runtime";
  runtime: {
    worker: "blender";
    script: string;
    estimatedSeconds: number;
  };
};

export type PresentationMockupDefinition =
  | BuiltinPresentationMockup
  | TemplatePresentationMockup
  | RuntimePresentationMockup;

export const BUILTIN_PRESENTATION_MOCKUPS: BuiltinPresentationMockup[] = [
  {
    id: "social-card",
    familyId: "social-card",
    version: 1,
    releaseStage: "production",
    assetKind: "mockup",
    rendererKind: "builtin",
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
    familyId: "staff-badge",
    version: 1,
    releaseStage: "production",
    assetKind: "mockup",
    rendererKind: "builtin",
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
    familyId: "tshirt-white",
    version: 1,
    releaseStage: "production",
    assetKind: "mockup",
    rendererKind: "builtin",
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
    familyId: "mug",
    version: 1,
    releaseStage: "production",
    assetKind: "generated",
    rendererKind: "generated",
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
    familyId: "tote",
    version: 1,
    releaseStage: "production",
    assetKind: "generated",
    rendererKind: "generated",
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
    familyId: "cap",
    version: 1,
    releaseStage: "production",
    assetKind: "generated",
    rendererKind: "generated",
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

export const RUNTIME_PRESENTATION_MOCKUPS: RuntimePresentationMockup[] = [
  {
    id: "workflow-neon-sign-v1",
    familyId: "workflow-neon-sign",
    version: 1,
    releaseStage: "draft",
    assetKind: "mockup",
    kind: "runtime",
    rendererKind: "runtime-blender",
    runtime: {
      worker: "blender",
      script: "labs/workflow/scripts/blender/neon_sign.py",
      estimatedSeconds: 390,
    },
    title: "ネオンサイン",
    scene: "onsite",
    templateCategory: "signage",
    category: "サイネージ",
    sourceLab: "workflow",
    allowedPlacements: ["onsite.primary"],
    defaultMappings: [],
    config: {
      parameters: {
        colorMode: {
          type: "string",
          enum: ["logo", "warm-white"],
          default: "logo",
        },
      },
    },
    notesJa:
      "SVGパスを発光チューブ形状へ変換し、ロゴごとにBlenderでレンダーするランタイム候補。現在は品質検証中のためプレゼン選択肢には出さない。",
    impressions: ["ネオン", "立体", "夜景"],
    presentationAdopted: false,
    presentationOrder: 5,
  },
];

export const CODE_PRESENTATION_MOCKUPS: PresentationMockupDefinition[] = [
  ...BUILTIN_PRESENTATION_MOCKUPS,
  ...RUNTIME_PRESENTATION_MOCKUPS,
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
    familyId: template.familyId ?? template.id,
    version: template.version ?? 1,
    releaseStage: template.releaseStage ?? "draft",
    kind: "template",
    template,
    title: template.nameJa,
    assetKind: "mockup",
    rendererKind: template.surface.uvWarp ? "template-uv" : "template-2d",
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
