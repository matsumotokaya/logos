// UI copy for all supported locales. English is the canonical shape;
// every locale must provide the full dictionary (no runtime fallback holes).

export type Dict = {
  header: {
    admin: string;
    newLogo: string;
    brandName: string;
    language: string;
  };
  footer: {
    generatedWith: string; // {service}
  };
  landing: {
    kicker: string;
    headline: string;
    sub: string;
    upload: string;
    drop: string;
    sample: string;
    privacy: string;
    svgOnly: string;
    errors: {
      svgOnly: string;
      readFailed: string;
      sampleFailed: string;
    };
  };
  doc: {
    brandGuidelines: string;
    version: string;
    contents: string;
  };
  splash: {
    scrollCue: string;
    replay: string;
    pause: string;
    play: string;
  };
  identity: {
    title: string;
    // {name} {anchors} {colors}
    lead: string;
    body: string;
  };
  // Shared strings for on-demand AI generation controls.
  gen: {
    action: string;
    scene: string;
    generating: string;
    retry: string;
    failed: string;
  };
  // Per-section editorial copy. Spec-like labels (HEX, RGB, px sizes,
  // variant captions) intentionally stay in English mono across locales,
  // as in printed brand guidelines.
  sections: {
    construction: {
      lead: string;
      anchors: string; // {n}
      handles: string; // {n}
    };
    color: { lead: string };
    usage: { lead: string };
    appIcon: { lead: string };
    web: { lead: string };
    social: { lead: string; bio: string };
    onsite: { lead: string };
    merch: { lead: string; caption: string };
    generated: { lead: string; mug: string; tote: string; cap: string };
  };
  scenes: {
    identity: string;
    construction: string;
    color: string;
    usage: string;
    appIcon: string;
    web: string;
    social: string;
    onsite: string;
    merch: string;
    generated: string;
  };
};

const en: Dict = {
  header: {
    admin: "Admin",
    newLogo: "New logo",
    brandName: "Brand name",
    language: "Language",
  },
  footer: {
    generatedWith: "Generated with {service}",
  },
  landing: {
    kicker: "Brand guidelines, generated",
    headline: "One mark in. A living identity out.",
    sub: "Upload a single SVG logo and watch a complete set of brand guidelines assemble itself — construction, color, applications and photoreal mockups.",
    upload: "Upload SVG",
    drop: "Drop your SVG anywhere",
    sample: "View the sample presentation",
    privacy: "Analysis runs entirely in your browser. Your logo never leaves this device.",
    svgOnly: "SVG only — PNG support is on the roadmap.",
    errors: {
      svgOnly:
        "This proof of concept accepts SVG only. PNG and Illustrator support is on the roadmap.",
      readFailed: "Could not read this file.",
      sampleFailed: "Could not load the sample.",
    },
  },
  doc: {
    brandGuidelines: "Brand Guidelines",
    version: "Version",
    contents: "Contents",
  },
  splash: {
    scrollCue: "Scroll",
    replay: "Replay",
    pause: "Stop",
    play: "Play",
  },
  identity: {
    title: "The mark",
    lead: "The {name} mark is drawn as pure vector geometry — {anchors} anchor points, {colors} colors.",
    body: "It scales from a 16-pixel favicon to a building façade without losing a single curve. Every application in this document is derived from this one master file.",
  },
  gen: {
    action: "Generate",
    scene: "Generate scene",
    generating: "Generating…",
    retry: "Retry",
    failed: "Generation failed.",
  },
  sections: {
    construction: {
      lead: "The mark is constructed from measured curves. Every anchor point and control handle shown here is extracted from the master file itself.",
      anchors: "{n} anchor points",
      handles: "{n} control handles",
    },
    color: {
      lead: "The palette is extracted from the mark by visual weight. Each color is specified for both print and screen.",
    },
    usage: {
      lead: "Four approved reproductions of the mark. Never redraw, recolor or distort it beyond these variants.",
    },
    appIcon: {
      lead: "On the home screen the mark holds its own — one primary tile, with approved alternates.",
    },
    web: {
      lead: "In the browser the mark stays legible at every size, down to a 16-pixel favicon.",
    },
    social: {
      lead: "Profile artwork is composed from the primary color and the mono mark.",
      bio: "Official account. One logo, every asset.",
    },
    onsite: {
      lead: "On-site credentials carry the mark in white on the darkened brand primary.",
    },
    merch: {
      lead: "Apparel carries the primary mark, printed center chest.",
      caption: "Center chest print — multiply composite",
    },
    generated: {
      lead: "Photoreal mockups, generated on demand from the master file.",
      mug: "Ceramic mug",
      tote: "Tote bag",
      cap: "Cap",
    },
  },
  scenes: {
    identity: "The mark",
    construction: "Construction",
    color: "Color",
    usage: "Logo usage",
    appIcon: "App icon",
    web: "Web",
    social: "Social",
    onsite: "On-site",
    merch: "Merchandise",
    generated: "Generated",
  },
};

const ja: Dict = {
  header: {
    admin: "管理",
    newLogo: "新しいロゴ",
    brandName: "ブランド名",
    language: "言語",
  },
  footer: {
    generatedWith: "{service} で生成",
  },
  landing: {
    kicker: "ブランドガイドラインを、自動生成",
    headline: "ロゴがひとつ。アイデンティティのすべて。",
    sub: "SVGロゴを1つアップロードするだけで、作図・カラー・アプリケーション・フォトリアルモックアップまで、ブランドガイドライン一式がその場で組み上がります。",
    upload: "SVGをアップロード",
    drop: "SVGをどこにでもドロップ",
    sample: "サンプルを見る",
    privacy: "解析はすべてブラウザ内で完結します。ロゴが外部に送信されることはありません。",
    svgOnly: "現在はSVGのみ対応。PNG対応はロードマップにあります。",
    errors: {
      svgOnly:
        "このPoCではSVGのみ受け付けています。PNG・Illustrator対応はロードマップにあります。",
      readFailed: "このファイルを読み込めませんでした。",
      sampleFailed: "サンプルを読み込めませんでした。",
    },
  },
  doc: {
    brandGuidelines: "ブランドガイドライン",
    version: "バージョン",
    contents: "目次",
  },
  splash: {
    scrollCue: "スクロール",
    replay: "リプレイ",
    pause: "停止",
    play: "再生",
  },
  identity: {
    title: "ロゴマーク",
    lead: "{name} のロゴマークは、純粋なベクター図形として描かれています。アンカーポイント{anchors}点、使用色{colors}色。",
    body: "16pxのファビコンから建築サイネージまで、曲線をひとつも失うことなくスケールします。本書のすべてのアプリケーションは、この1つのマスターファイルから派生しています。",
  },
  gen: {
    action: "生成",
    scene: "シーンを生成",
    generating: "生成中…",
    retry: "再試行",
    failed: "生成に失敗しました。",
  },
  sections: {
    construction: {
      lead: "ロゴマークは計測された曲線によって作図されています。ここに示すアンカーポイントとコントロールハンドルは、すべてマスターファイルそのものから抽出したものです。",
      anchors: "アンカーポイント {n} 点",
      handles: "コントロールハンドル {n} 本",
    },
    color: {
      lead: "カラーパレットは、ロゴマークから面積加重で抽出されています。各色には印刷用・画面用の色値を定義します。",
    },
    usage: {
      lead: "承認された4つの再現パターンです。これ以外の再描画・再配色・変形は行わないでください。",
    },
    appIcon: {
      lead: "ホーム画面でもロゴマークは存在感を保ちます。プライマリタイルと、承認済みのバリエーションを示します。",
    },
    web: {
      lead: "ブラウザ上では、16pxのファビコンに至るまで、あらゆるサイズで判読性を保ちます。",
    },
    social: {
      lead: "プロフィールのアートワークは、プライマリカラーと単色ロゴで構成します。",
      bio: "公式アカウント。ひとつのロゴから、すべてのアセットへ。",
    },
    onsite: {
      lead: "オンサイトの社員証は、ブランドカラーを暗くした地に白抜きのロゴを載せます。",
    },
    merch: {
      lead: "アパレルには、胸の中央にプライマリロゴをプリントします。",
      caption: "胸中央プリント — multiply合成",
    },
    generated: {
      lead: "マスターファイルから、フォトリアルなモックアップをオンデマンドで生成します。",
      mug: "マグカップ",
      tote: "トートバッグ",
      cap: "キャップ",
    },
  },
  scenes: {
    identity: "ロゴマーク",
    construction: "作図",
    color: "カラー",
    usage: "ロゴの使用",
    appIcon: "アプリアイコン",
    web: "ウェブ",
    social: "ソーシャル",
    onsite: "オンサイト",
    merch: "マーチャンダイズ",
    generated: "生成モックアップ",
  },
};

const ko: Dict = {
  header: {
    admin: "관리",
    newLogo: "새 로고",
    brandName: "브랜드명",
    language: "언어",
  },
  footer: {
    generatedWith: "{service}(으)로 생성",
  },
  landing: {
    kicker: "브랜드 가이드라인, 자동 생성",
    headline: "하나의 로고, 완성된 아이덴티티.",
    sub: "SVG 로고 하나만 업로드하면 구조, 컬러, 애플리케이션, 포토리얼 목업까지 브랜드 가이드라인 전체가 즉시 완성됩니다.",
    upload: "SVG 업로드",
    drop: "SVG를 어디에나 드롭하세요",
    sample: "샘플 프레젠테이션 보기",
    privacy: "분석은 모두 브라우저 안에서 이루어집니다. 로고가 외부로 전송되지 않습니다.",
    svgOnly: "현재 SVG만 지원합니다. PNG 지원은 로드맵에 있습니다.",
    errors: {
      svgOnly:
        "이 PoC는 SVG만 지원합니다. PNG 및 Illustrator 지원은 로드맵에 있습니다.",
      readFailed: "이 파일을 읽을 수 없습니다.",
      sampleFailed: "샘플을 불러올 수 없습니다.",
    },
  },
  doc: {
    brandGuidelines: "브랜드 가이드라인",
    version: "버전",
    contents: "목차",
  },
  splash: {
    scrollCue: "스크롤",
    replay: "다시 재생",
    pause: "정지",
    play: "재생",
  },
  identity: {
    title: "로고 마크",
    lead: "{name}의 로고 마크는 순수한 벡터 도형으로 그려져 있습니다. 앵커 포인트 {anchors}개, 사용 색상 {colors}색.",
    body: "16px 파비콘부터 건축 사이니지까지, 곡선 하나 잃지 않고 스케일됩니다. 이 문서의 모든 애플리케이션은 이 하나의 마스터 파일에서 파생됩니다.",
  },
  gen: {
    action: "생성",
    scene: "장면 생성",
    generating: "생성 중…",
    retry: "다시 시도",
    failed: "생성에 실패했습니다.",
  },
  sections: {
    construction: {
      lead: "로고 마크는 측정된 곡선으로 제도되어 있습니다. 여기 표시된 앵커 포인트와 컨트롤 핸들은 모두 마스터 파일 자체에서 추출한 것입니다.",
      anchors: "앵커 포인트 {n}개",
      handles: "컨트롤 핸들 {n}개",
    },
    color: {
      lead: "컬러 팔레트는 로고 마크에서 시각적 비중에 따라 추출됩니다. 각 색상은 인쇄용과 화면용 색상 값으로 정의됩니다.",
    },
    usage: {
      lead: "승인된 4가지 재현 패턴입니다. 이 외의 재작도·재배색·변형은 허용되지 않습니다.",
    },
    appIcon: {
      lead: "홈 화면에서도 로고 마크는 존재감을 유지합니다. 프라이머리 타일과 승인된 변형을 제시합니다.",
    },
    web: {
      lead: "브라우저에서는 16px 파비콘에 이르기까지 모든 크기에서 판독성을 유지합니다.",
    },
    social: {
      lead: "프로필 아트워크는 프라이머리 컬러와 단색 마크로 구성됩니다.",
      bio: "공식 계정. 하나의 로고, 모든 애셋.",
    },
    onsite: {
      lead: "온사이트 사원증은 어둡게 처리한 브랜드 컬러 위에 흰색 로고를 얹습니다.",
    },
    merch: {
      lead: "어패럴에는 가슴 중앙에 프라이머리 로고를 프린트합니다.",
      caption: "가슴 중앙 프린트 — multiply 합성",
    },
    generated: {
      lead: "마스터 파일에서 포토리얼 목업을 온디맨드로 생성합니다.",
      mug: "머그컵",
      tote: "토트백",
      cap: "캡",
    },
  },
  scenes: {
    identity: "로고 마크",
    construction: "구조",
    color: "컬러",
    usage: "로고 사용",
    appIcon: "앱 아이콘",
    web: "웹",
    social: "소셜",
    onsite: "온사이트",
    merch: "머천다이즈",
    generated: "생성 목업",
  },
};

const zhHant: Dict = {
  header: {
    admin: "管理",
    newLogo: "新標誌",
    brandName: "品牌名稱",
    language: "語言",
  },
  footer: {
    generatedWith: "由 {service} 生成",
  },
  landing: {
    kicker: "品牌規範,自動生成",
    headline: "一個標誌,完整的品牌識別。",
    sub: "只需上傳一個 SVG 標誌,製圖、色彩、應用場景到擬真樣機,完整的品牌規範即刻生成。",
    upload: "上傳 SVG",
    drop: "將 SVG 拖放到任意位置",
    sample: "查看範例簡報",
    privacy: "所有分析皆在瀏覽器中完成,您的標誌不會被傳送到外部。",
    svgOnly: "目前僅支援 SVG,PNG 支援已在規劃中。",
    errors: {
      svgOnly: "此概念驗證僅接受 SVG。PNG 與 Illustrator 支援已在規劃中。",
      readFailed: "無法讀取此檔案。",
      sampleFailed: "無法載入範例。",
    },
  },
  doc: {
    brandGuidelines: "品牌規範",
    version: "版本",
    contents: "目錄",
  },
  splash: {
    scrollCue: "捲動",
    replay: "重播",
    pause: "停止",
    play: "播放",
  },
  identity: {
    title: "標誌",
    lead: "{name} 的標誌以純向量幾何繪製——錨點 {anchors} 個,使用色彩 {colors} 種。",
    body: "從 16 像素的網站圖示到建築外牆,每一條曲線都完整保留。本文件中的所有應用皆源自這一個主檔案。",
  },
  gen: {
    action: "生成",
    scene: "生成場景",
    generating: "生成中…",
    retry: "重試",
    failed: "生成失敗。",
  },
  sections: {
    construction: {
      lead: "標誌以精確測量的曲線繪製而成。此處顯示的錨點與控制桿,皆直接取自主檔案。",
      anchors: "錨點 {n} 個",
      handles: "控制桿 {n} 條",
    },
    color: {
      lead: "色彩系統依視覺比重自標誌中萃取。每個色彩皆定義印刷與螢幕用色值。",
    },
    usage: {
      lead: "以下為四種核可的重現方式。請勿以其他方式重繪、改色或變形標誌。",
    },
    appIcon: {
      lead: "標誌在主畫面上同樣醒目——主圖磚與核可的變化版本如下。",
    },
    web: {
      lead: "在瀏覽器中,標誌縮小至 16 像素的網站圖示仍清晰可辨。",
    },
    social: {
      lead: "個人檔案視覺由主色與單色標誌構成。",
      bio: "官方帳號。一個標誌,所有資產。",
    },
    onsite: {
      lead: "實地識別證以加深的品牌主色為底,搭配白色標誌。",
    },
    merch: {
      lead: "服飾類商品於胸前正中印上主標誌。",
      caption: "胸前正中印刷 — multiply 合成",
    },
    generated: {
      lead: "由主檔案隨需生成擬真樣機。",
      mug: "馬克杯",
      tote: "托特包",
      cap: "棒球帽",
    },
  },
  scenes: {
    identity: "標誌",
    construction: "製圖",
    color: "色彩",
    usage: "標誌使用",
    appIcon: "應用程式圖示",
    web: "網頁",
    social: "社群",
    onsite: "實地應用",
    merch: "周邊商品",
    generated: "生成樣機",
  },
};

const zhHans: Dict = {
  header: {
    admin: "管理",
    newLogo: "新标志",
    brandName: "品牌名称",
    language: "语言",
  },
  footer: {
    generatedWith: "由 {service} 生成",
  },
  landing: {
    kicker: "品牌规范,自动生成",
    headline: "一个标志,完整的品牌识别。",
    sub: "只需上传一个 SVG 标志,制图、色彩、应用场景到写实样机,完整的品牌规范即刻生成。",
    upload: "上传 SVG",
    drop: "将 SVG 拖放到任意位置",
    sample: "查看示例演示",
    privacy: "所有分析均在浏览器中完成,您的标志不会被发送到外部。",
    svgOnly: "目前仅支持 SVG,PNG 支持已在规划中。",
    errors: {
      svgOnly: "此概念验证仅接受 SVG。PNG 与 Illustrator 支持已在规划中。",
      readFailed: "无法读取此文件。",
      sampleFailed: "无法加载示例。",
    },
  },
  doc: {
    brandGuidelines: "品牌规范",
    version: "版本",
    contents: "目录",
  },
  splash: {
    scrollCue: "滚动",
    replay: "重播",
    pause: "停止",
    play: "播放",
  },
  identity: {
    title: "标志",
    lead: "{name} 的标志以纯矢量几何绘制——锚点 {anchors} 个,使用色彩 {colors} 种。",
    body: "从 16 像素的网站图标到建筑外墙,每一条曲线都完整保留。本文档中的所有应用均源自这一个主文件。",
  },
  gen: {
    action: "生成",
    scene: "生成场景",
    generating: "生成中…",
    retry: "重试",
    failed: "生成失败。",
  },
  sections: {
    construction: {
      lead: "标志以精确测量的曲线绘制而成。此处显示的锚点与控制柄,均直接取自主文件。",
      anchors: "锚点 {n} 个",
      handles: "控制柄 {n} 条",
    },
    color: {
      lead: "色彩系统按视觉比重从标志中提取。每个色彩均定义印刷与屏幕用色值。",
    },
    usage: {
      lead: "以下为四种核准的重现方式。请勿以其他方式重绘、改色或变形标志。",
    },
    appIcon: {
      lead: "标志在主屏幕上同样醒目——主图块与核准的变体如下。",
    },
    web: {
      lead: "在浏览器中,标志缩小至 16 像素的网站图标仍清晰可辨。",
    },
    social: {
      lead: "个人资料视觉由主色与单色标志构成。",
      bio: "官方账号。一个标志,所有资产。",
    },
    onsite: {
      lead: "实地工作证以加深的品牌主色为底,搭配白色标志。",
    },
    merch: {
      lead: "服饰类商品于胸前正中印上主标志。",
      caption: "胸前正中印刷 — multiply 合成",
    },
    generated: {
      lead: "由主文件按需生成写实样机。",
      mug: "马克杯",
      tote: "托特包",
      cap: "棒球帽",
    },
  },
  scenes: {
    identity: "标志",
    construction: "制图",
    color: "色彩",
    usage: "标志使用",
    appIcon: "应用图标",
    web: "网页",
    social: "社交",
    onsite: "实地应用",
    merch: "周边商品",
    generated: "生成样机",
  },
};

export const LOCALES = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "ja", label: "日本語", htmlLang: "ja" },
  { code: "ko", label: "한국어", htmlLang: "ko" },
  { code: "zh-Hant", label: "繁體中文", htmlLang: "zh-Hant" },
  { code: "zh-Hans", label: "简体中文", htmlLang: "zh-Hans" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DICTIONARIES: Record<Locale, Dict> = {
  en,
  ja,
  ko,
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
};
