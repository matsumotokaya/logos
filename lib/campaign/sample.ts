import {
  narrationTextFromScript,
  type CampaignBrandKit,
  type CmScene,
} from "./schema";

// The bundled sample campaign: CM Maker's own sales page.
//
// This is the placeholder that fills /campaigns before a user runs anything
// (NotebookLM-style「最初から結果が当てはまっている」), and simultaneously the
// reference output of design type #1「SaaS型」— the fixed pattern every input
// is rendered into first. All numbers, clients, quotes and pricing are
// hand-written PLAUSIBLE FICTION (仮情報); the LP labels them as sample data.
//
// Plain data only — imported from both server routes and client components.

export const SAMPLE_CAMPAIGN_ID = "sample";

/** Committed sample CM assets (regenerate: npm run campaign:sample-voice,
 *  then npm run campaign:render -- --sample --out public/campaigns/sample-cm.mp4). */
export const SAMPLE_CM_AUDIO = "/campaigns/sample-cm.wav";
export const SAMPLE_CM_VIDEO = "/campaigns/sample-cm.mp4";

// Hand-written 5-scene CM script (same problem-solution template the LLM
// fills for generated campaigns). One scene = one TTS section = one video
// sequence; the flat narration below is derived from it.
const sampleCmScript: CmScene[] = [
  { role: "hook", text: "新しいサービス、作りっぱなしになっていませんか。" },
  { role: "problem", text: "LPを作る時間も、動画を作る予算もない。" },
  { role: "solution", text: "そんな立ち上げ期のあなたへ、CM Maker。" },
  {
    role: "features",
    text: "サービスのURLを貼るだけで、ブランドを理解したセールスページと30秒CMが数分で完成します。色もロゴも、あなたのサービスのまま。",
  },
  {
    role: "cta",
    text: "マーケティングの最初の一歩は、もう自動でいい。CM Makerで、今日から売り始めよう。",
  },
];

export const sampleCampaignKit: CampaignBrandKit = {
  organization: {
    name: "Logos",
    organization_kind: "company",
    website: null,
    description: "ブランド情報とマーケティング成果物を一体で管理するサービスの運営主体。",
    relationship: "same_identity",
    confidence: "high",
    evidence: "プロジェクト内で管理している公式サンプル",
  },
  service: {
    name: "CM Maker",
    tagline: "URLひとつで、LPと30秒CM。",
    description:
      "サービスのURLやチラシ・企画書を渡すだけで、ブランドを理解したセールスページと30秒CM動画を自動生成するマーケティングツール。デザイナーがいなくても、公開できる品質の販促一式がその場で手に入る。",
    industry: "マーケティングSaaS",
    business_type: "saas",
    offering: "URL・資料からセールスページと紹介動画を自動生成するサービス",
    audience: "新規事業・スタートアップの立ち上げ期チーム、サービスを量産するAI開発者",
    url: "/",
  },
  theme: "tech-glass",
  brand: {
    primary: "#6C2BFF",
    accent: "#4C1D95",
    background: "#FFFFFF",
    surface: "#F7F5FF",
    text: "#111827",
    palette_source: "extracted",
    mode: "light",
    font_style: "modern-sans",
  },
  copy: {
    hero: {
      headline: "サービスはできた。さあ、売ろう。",
      subheadline:
        "URL・チラシ・企画書。サービスの中身がわかるものを渡すだけで、ブランドを理解したセールスページと30秒CMが数分で完成。マーケティング担当がまだいなくても、今日から売り始められます。",
      cta_label: "無料でつくってみる",
    },
    problem: {
      headline: "新規事業のマーケティング、こんな壁にぶつかっていませんか？",
      points: [
        "LP制作を外注すると数十万円、納期は1ヶ月。スピードが命の立ち上げ期に間に合わない",
        "デザイナーがいないので、ページごとに色もトーンもバラバラになっていく",
        "紹介動画まで手が回らず、SNSや広告に流せる素材がない",
        "AIでサービスは量産できるようになったのに、「売る」仕組みが追いつかない",
      ],
    },
    features: [
      {
        title: "ソースを渡すだけ",
        description:
          "URL、PDF、スクリーンショット、テキスト。サービスの内容がわかるものなら何でも入力になります。情報が少なくても、まず形になる——足りない部分はあとから差し替えるだけ。",
        emoji: "📥",
      },
      {
        title: "ブランドを理解する Brand Kit",
        description:
          "実際のサイトをレンダリングして、ロゴ・ブランドカラー・デザイントークンを証拠ベースで抽出。生成物すべてが同じデザイン基盤の上に乗るので、トーンがぶれません。",
        emoji: "🎨",
      },
      {
        title: "公開できる品質のセールスページ",
        description:
          "実績・料金・FAQまで揃ったSaaS型の完全なページ構成で出力。テンプレートが品質を保証するので、雑な入力でも壊れたページにはなりません。",
        emoji: "📄",
      },
      {
        title: "同じ素材から30秒CMへ",
        description:
          "ページと同じBrand Kitとナレーション原稿から、SNSや広告にそのまま流せる30秒の紹介動画を生成。ページと動画で語り口が揃います。",
        emoji: "🎬",
      },
    ],
    how_it_works: {
      headline: "使い方は3ステップ",
      steps: [
        {
          title: "ソースを追加",
          description: "サービスのURLを貼るか、チラシ・企画書・スクリーンショットをドロップ。",
        },
        {
          title: "生成を待つ",
          description:
            "ブランド抽出からページ組み立てまで自動で進行。処理はサーバー側で走るので、ページを閉じても大丈夫。",
        },
        {
          title: "公開・共有",
          description:
            "できあがったページと動画を確認して、URLひとつで共有。内容はあとからいつでも差し替えられます。",
        },
      ],
    },
    proof: {
      stats: [
        { value: "約3分", label: "平均生成時間" },
        { value: "0円", label: "はじめる費用" },
        { value: "1本", label: "必要なURL" },
      ],
      client_names: ["NIJIWORKS", "Alcove", "タベルテ", "MINT HR", "Kanade AI"],
    },
    testimonials: [
      {
        quote:
          "プロダクトは完成していたのに、LPがないせいで営業資料を毎回作っていました。URLを貼って数分で「見せられるページ」ができたときは、正直ずるいと思いました。",
        name: "田中 美咲",
        role: "共同創業者 / HRテックスタートアップ",
      },
      {
        quote:
          "AIエージェントで作った検証用サービスが毎週増えるので、1本ずつLPを作るのは不可能でした。いまは公開前のサービスにもとりあえず全部ページと動画を付けています。",
        name: "小林 蓮",
        role: "個人開発者",
      },
      {
        quote:
          "ブランドカラーを勝手に変えないのが決め手でした。既存サイトから色を抽出してくれるので、代理店に頼んだときのような「うちっぽくない」が起きません。",
        name: "佐藤 健太郎",
        role: "マーケティング責任者 / 会計SaaS",
      },
    ],
    pricing: {
      headline: "シンプルな料金プラン",
      plans: [
        {
          name: "Free",
          price: "¥0",
          period: "",
          description: "まず1本、作って試したい方に。",
          features: ["セールスページ生成 月3回", "Brand Kit ダウンロード", "共有URLの発行"],
          highlighted: false,
          cta_label: "無料で始める",
        },
        {
          name: "Pro",
          price: "¥4,980",
          period: "/月",
          description: "立ち上げ期のチーム・個人開発者に。",
          features: [
            "ページ生成 無制限",
            "30秒CM動画の書き出し",
            "生成内容の編集・差し替え",
            "独自ドメイン公開",
          ],
          highlighted: true,
          cta_label: "Proを始める",
        },
        {
          name: "Business",
          price: "¥29,800",
          period: "/月",
          description: "複数ブランドを運用する企業に。",
          features: [
            "ブランド・メンバー管理",
            "ブランドガイドライン連携",
            "SNSキット・バナー生成",
            "優先サポート",
          ],
          highlighted: false,
          cta_label: "相談する",
        },
      ],
    },
    faq: [
      {
        q: "ロゴや色が勝手に変わってしまいませんか？",
        a: "変わりません。実際のサイトをレンダリングして収集した証拠からブランドカラーを選ぶ仕組みで、AIによる色の発明を構造的に禁止しています。ロゴも取得した実物をそのまま使います。",
      },
      {
        q: "サービスの情報がまだ少なくても使えますか？",
        a: "使えます。実績や料金など足りない部分は、それらしい仮の内容で先にページを完成させ、サンプルであることを明示します。正式な情報が決まり次第、差し替えるだけです。",
      },
      {
        q: "動画はどうやって作られますか？",
        a: "ページと同じBrand Kitから生成されるナレーション原稿をもとに、音声合成とテンプレートで30秒のCM動画を組み立てます。ページと動画でトーンが揃うのが特長です。",
      },
      {
        q: "作ったページはどこに公開されますか？",
        a: "固有の共有URLが発行され、そのまま公開ページとして使えます。将来は独自ドメインでのホスティングにも対応予定です。",
      },
    ],
    closing: {
      headline: "最初の1ページを、いま作ろう。",
      subtext: "URLを貼るだけ。数分後には、あなたのサービスに「売る顔」ができています。",
      cta_label: "無料でつくってみる",
    },
  },
  cm_script: sampleCmScript,
  narration: narrationTextFromScript(sampleCmScript),
  assets: null,
  design_tokens: null,
};
