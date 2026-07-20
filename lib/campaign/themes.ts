// Campaign design themes — the parameterized template axis shared by every
// renderer. A theme is a creative direction (tone & manner) plus rendering
// parameters. Today it drives the LP template variant and biases the
// generated palette / copy tone; the same `direction` text is designed to be
// fed to the upcoming renderers (30s CM video, banners, BGM selection) so all
// assets of one campaign stay on the same tone.
//
// The chosen theme is stored on the Brand Kit (`kit.theme`), so it can be
// changed later and every asset re-rendered from the same kit.
//
// Plain data + pure functions only — imported from server routes, the LP
// renderer and client components alike.

export const CAMPAIGN_THEME_IDS = [
  "tech-glass",
  "minimal-light",
  "corporate-trust",
  "care-warm",
  "friendly-pop",
  "food-casual",
  "luxury-serif",
] as const;

export type CampaignThemeId = (typeof CAMPAIGN_THEME_IDS)[number];

export interface CampaignTheme {
  id: CampaignThemeId;
  /** Display name shown in UI (Japanese). */
  label: string;
  /** Industries this theme is intended for (docs / UI hint). */
  audience: string;
  /** Selection criteria — written for the LLM that assigns a theme. */
  selection: string;
  /**
   * Creative direction for ALL renderers (LP copy tone, narration voice,
   * and the future video / banner / BGM stages). Written as an instruction
   * to a creative team.
   */
  direction: string;
  /** LP rendering parameters. */
  lp: {
    /** "glass" = dark frosted-glass template, "flat" = light flat template. */
    variant: "glass" | "flat";
    /**
     * Hero-section background photo (public URL path + rgba scrim). The hero
     * renders white text over the dimmed photo; the rest of the page keeps
     * the template's own canvas. Absent = the template's CSS-only hero.
     * Current set: the curated abstract-glass photos in public/campaigns/bg/,
     * fixed per theme; dedicated per-theme shoots can replace them later.
     */
    heroBackground?: { src: string; scrim: string };
  };
}

export const CAMPAIGN_THEMES: Record<CampaignThemeId, CampaignTheme> = {
  "tech-glass": {
    id: "tech-glass",
    label: "テックグラス",
    audience: "SaaS・AI・開発者ツール・フィンテックなどの先進テック",
    selection:
      "テック系・ソフトウェア・AI・スタートアップ全般。先進性やスピード感を打ち出したいサービス",
    direction:
      "ダークトーンにガラス質感（フロストグラス）の近未来的な世界観。深い夜色の背景にブランドカラーが発光するように差す。余白は広く、コピーは短く自信のある断定調。BGMはミニマルなエレクトロニカ、ナレーションは落ち着いた低めのトーン。",
    lp: {
      variant: "glass",
      heroBackground: { src: "/campaigns/bg/simon-nilsen.jpg", scrim: "rgba(6,11,34,0.45)" },
    },
  },
  "minimal-light": {
    id: "minimal-light",
    label: "ミニマルライト",
    audience: "B2Bサービス全般・業務ツール（迷ったらこれ）",
    selection:
      "汎用のデフォルト。誠実さと分かりやすさを優先する業務サービス、または他のテーマに当てはまらない場合",
    direction:
      "白ベースのクリーンなSaaSスタイル。ブランドカラーをアクセントとして要所にだけ使い、情報の分かりやすさを最優先する。コピーは丁寧で具体的、BGMは軽快なコーポレートポップ、ナレーションは明るく信頼感のあるトーン。",
    lp: {
      variant: "flat",
      heroBackground: { src: "/campaigns/bg/milad-fakurian.jpg", scrim: "rgba(10,14,26,0.5)" },
    },
  },
  "corporate-trust": {
    id: "corporate-trust",
    label: "コーポレートトラスト",
    audience: "金融・不動産・保険・士業・コンサルティング",
    selection:
      "信頼・実績・堅実さが第一の業種。金融、不動産、法務・会計、企業向けコンサルなど",
    direction:
      "ネイビーやチャコールを基調にした端正で構造的なデザイン。装飾を抑え、数字と実績を大きく見せる。コピーは敬体で堅実、誇張しない。BGMは弦楽やピアノの落ち着いた曲、ナレーションは重厚で信頼感のある声。",
    lp: {
      variant: "flat",
      heroBackground: { src: "/campaigns/bg/pramod-tiwari.jpg", scrim: "rgba(8,14,30,0.55)" },
    },
  },
  "care-warm": {
    id: "care-warm",
    label: "ケアウォーム",
    audience: "福祉・介護・医療・保育・教育",
    selection:
      "人に寄り添う業種。福祉、介護、医療・ヘルスケア、保育・教育、地域サービスなど",
    direction:
      "グリーンやオレンジなどのあたたかい中間色と丸みのある形。安心感と親しみやすさを最優先し、写真やイラストは人の表情を感じさせるものを想定する。コピーはやわらかい語りかけ調。BGMはアコースティック、ナレーションはあたたかく穏やかなトーン。",
    lp: {
      variant: "flat",
      heroBackground: { src: "/campaigns/bg/hassaan-here.jpg", scrim: "rgba(6,20,26,0.5)" },
    },
  },
  "friendly-pop": {
    id: "friendly-pop",
    label: "フレンドリーポップ",
    audience: "コンシューマアプリ・コミュニティ・イベント",
    selection:
      "個人ユーザー向けの明るいサービス。コンシューマアプリ、コミュニティ、イベント、エンタメなど",
    direction:
      "明るい色数の多いポップな世界観。大きめの絵文字やイラスト的要素、角丸の大きいUI。コピーは口語でテンポよく、絵文字も許容。BGMはアップテンポなポップス、ナレーションは若く元気なトーン。",
    lp: { variant: "flat" },
  },
  "food-casual": {
    id: "food-casual",
    label: "フードカジュアル",
    audience: "大衆飲食・食品EC・小売",
    selection:
      "日常的な飲食・食品・小売。カフェ、定食、テイクアウト、食品EC、商店など(高級業態はluxury-serifへ)",
    direction:
      "食欲を誘う暖色（赤・オレンジ・ブラウン）を軸にした活気のあるデザイン。シズル感のある写真を主役に想定し、価格やメニューを大きく見せる。コピーは短く威勢よく。BGMは軽快で楽しい曲、ナレーションは親しみのある元気なトーン。",
    lp: { variant: "flat" },
  },
  "luxury-serif": {
    id: "luxury-serif",
    label: "ラグジュアリーセリフ",
    audience: "高級飲食・ホテル・美容・ジュエリー",
    selection:
      "高価格帯・上質さが価値の業態。高級レストラン、ホテル・旅館、美容、ジュエリー、ハイブランドなど",
    direction:
      "深い黒に近い背景に金や生成りを効かせた静かな高級感。セリフ体（明朝体）を主役にし、余白を贅沢に使う。コピーは寡黙で詩的、説明しすぎない。BGMはジャズやクラシック、ナレーションはささやくように上品なトーン。",
    lp: {
      variant: "glass",
      heroBackground: { src: "/campaigns/bg/philip-oroni.jpg", scrim: "rgba(4,6,14,0.45)" },
    },
  },
};

/** Fallback for kits generated before themes existed (keeps their current look). */
export const DEFAULT_THEME_ID: CampaignThemeId = "minimal-light";

function isThemeId(v: unknown): v is CampaignThemeId {
  return (
    typeof v === "string" && (CAMPAIGN_THEME_IDS as readonly string[]).includes(v)
  );
}

/** Resolve a kit's theme, tolerating pre-theme kits and unknown values. */
export function resolveTheme(
  kit: { theme?: string | null } | null | undefined
): CampaignTheme {
  const id = kit?.theme;
  return CAMPAIGN_THEMES[isThemeId(id) ? id : DEFAULT_THEME_ID];
}

/** The theme catalog as prompt text for the LLM's theme assignment. */
export function describeThemesForPrompt(): string {
  const lines = CAMPAIGN_THEME_IDS.map((id) => {
    const t = CAMPAIGN_THEMES[id];
    return `- ${t.id}: ${t.selection}。方向性: ${t.direction}`;
  });
  return `# Design theme catalog (choose exactly one id for \`theme\`)\n${lines.join("\n")}`;
}
