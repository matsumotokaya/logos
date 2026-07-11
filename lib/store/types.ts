// Persistence contract. The UI only talks to this interface, so swapping
// localStorage for a real database (e.g. Supabase) later means implementing
// BrandRepo once and changing the export in lib/store/index.ts — nothing else.
//
// The StoredLogo shape mirrors the canonical-record design in
// docs/data-model.md (layer A: master file + formal info, layer C: tags).

import type { LogoData } from "@/lib/svg";

export type LogoRole = "brand" | "corporate" | "service" | "subsidiary" | "other";

export const LOGO_ROLE_LABELS: Record<LogoRole, string> = {
  brand: "ブランドロゴ",
  corporate: "コーポレートロゴ",
  service: "サービスロゴ",
  subsidiary: "子会社・グループ",
  other: "その他",
};

export type LogoType = "symbol" | "logotype" | "combination" | "emblem";

export const LOGO_TYPE_LABELS: Record<LogoType, string> = {
  symbol: "シンボル",
  logotype: "ロゴタイプ",
  combination: "コンビネーション",
  emblem: "エンブレム",
};

export type LogoVisibility = "draft" | "private" | "unlisted" | "public";

export const VISIBILITY_LABELS: Record<LogoVisibility, string> = {
  draft: "下書き",
  private: "非公開",
  unlisted: "限定公開（URLを知っている人）",
  public: "公開",
};

export type CreditRole = "designer" | "studio" | "art_director" | "other";

export const CREDIT_ROLE_LABELS: Record<CreditRole, string> = {
  designer: "デザイナー",
  studio: "制作会社",
  art_director: "アートディレクター",
  other: "その他",
};

/** Creator credit. People and studios outside the service can be listed. */
export type LogoCredit = {
  id: string;
  role: CreditRole;
  name: string;
  contact: string; // email or URL
};

export type TrademarkStatus = "registered" | "pending" | "unregistered";

export const TRADEMARK_STATUS_LABELS: Record<TrademarkStatus, string> = {
  registered: "登録済み",
  pending: "出願中",
  unregistered: "未登録",
};

export type TrademarkType = "word" | "device" | "combined" | "3d" | "other";

export const TRADEMARK_TYPE_LABELS: Record<TrademarkType, string> = {
  word: "文字商標",
  device: "図形商標",
  combined: "結合商標",
  "3d": "立体商標",
  other: "その他",
};

/** One trademark registration. A logo can hold several (per country/class). */
export type LogoTrademark = {
  id: string;
  status: TrademarkStatus;
  jurisdiction: string; // e.g. "JP", "US", "WIPO"
  registrationNo: string;
  trademarkType: TrademarkType | null;
  niceClasses: number[]; // Nice Classification, 1–45
  goodsServices: string; // designated goods and services
};

export type LogoActivityAction =
  | "created"
  | "file_updated"
  | "info_updated"
  | "visibility_changed"
  | "presentation_updated";

export const ACTIVITY_LABELS: Record<LogoActivityAction, string> = {
  created: "登録",
  file_updated: "ファイル差し替え",
  info_updated: "情報更新",
  visibility_changed: "公開範囲変更",
  presentation_updated: "プレゼン編集",
};

/** Append-only work-history entry (who/when comes with user accounts). */
export type LogoActivity = {
  id: string;
  action: LogoActivityAction;
  at: string; // ISO 8601
};

export type StoredLogo = {
  id: string;
  title: string;
  role: LogoRole;
  data: LogoData;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // Canonical record (docs/data-model.md layer A)
  logoType: LogoType | null;
  parentId: string | null; // self-referencing tree: corporate → brand → service…
  visibility: LogoVisibility;
  credits: LogoCredit[];
  trademarks: LogoTrademark[];
  activities: LogoActivity[];
  // Discovery metadata (layer C)
  tags: string[];
  /**
   * Transient (not persisted): whether the current viewer may edit this logo.
   * Set by the repo. undefined means "no auth model" (localStorage mode),
   * treated as editable. Writes are always enforced by RLS server-side too.
   */
  canEdit?: boolean;
};

/** Fields editable through updateLogo. File content goes through replaceLogoData. */
export type LogoPatch = Partial<
  Pick<
    StoredLogo,
    | "title"
    | "role"
    | "logoType"
    | "parentId"
    | "visibility"
    | "credits"
    | "trademarks"
    | "tags"
  >
>;

/** Build a fresh StoredLogo with canonical-record defaults. */
export function createStoredLogo(args: {
  id: string;
  title: string;
  role: LogoRole;
  data: LogoData;
}): StoredLogo {
  const now = new Date().toISOString();
  return {
    ...args,
    createdAt: now,
    updatedAt: now,
    logoType: null,
    parentId: null,
    visibility: "draft",
    credits: [],
    trademarks: [],
    activities: [{ id: crypto.randomUUID(), action: "created", at: now }],
    tags: [],
  };
}

/** Per-scene copy overrides, keyed by scene slug ("color", "usage", …). */
export type SceneTextOverride = {
  /** Replaces the auto-generated lead paragraph of the section. */
  lead?: string;
};

/**
 * Layer B of the canonical record (docs/data-model.md): the editorial,
 * blog-like content of a presentation. One per logo. When a field is empty
 * the presentation falls back to its auto-generated copy, so an unedited
 * presentation still works end to end.
 */
export type LogoPresentation = {
  catchphrase: string; // shown on the Splash cover
  story: string; // shown in the Identity section body
  sceneTexts: Record<string, SceneTextOverride>;
  updatedAt: string; // ISO 8601
};

export function emptyPresentation(): LogoPresentation {
  return {
    catchphrase: "",
    story: "",
    sceneTexts: {},
    updatedAt: new Date().toISOString(),
  };
}

export type Company = {
  name: string;
  description: string;
  website: string;
  industry: string;
  location: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  spec: string;
  category: "アパレル" | "ドリンクウェア" | "ステーショナリー" | "ノベルティ";
  emoji: string;
  unit: string;
  unitPrice: number; // JPY
  stock: number;
  parLevel: number; // 適正在庫
  pendingQty: number; // 発注済み・入荷待ち
  lastOrderedAt: string | null;
};

export type Order = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  amount: number; // JPY
  status: "ordered" | "delivered";
  orderedAt: string;
};

/**
 * Cached photoreal mockups for one logo, keyed by scene slot ("mug", "tote",
 * "cap", …). Values are image data URLs. Generating these calls a paid API,
 * so results are persisted and reused instead of regenerated on every visit.
 */
export type GeneratedMockups = Record<string, string>;

export interface BrandRepo {
  getCompany(): Promise<Company>;
  saveCompany(company: Company): Promise<void>;

  listLogos(): Promise<StoredLogo[]>;
  getLogo(id: string): Promise<StoredLogo | null>;
  saveLogo(logo: StoredLogo): Promise<void>;
  updateLogo(id: string, patch: LogoPatch): Promise<void>;
  /** Overwrite the master file in place (no version kept), logging the update. */
  replaceLogoData(id: string, data: LogoData): Promise<void>;
  deleteLogo(id: string): Promise<void>;

  /** Layer B editorial content; returns an empty presentation when unedited. */
  getPresentation(logoId: string): Promise<LogoPresentation>;
  savePresentation(logoId: string, presentation: LogoPresentation): Promise<void>;

  listInventory(): Promise<InventoryItem[]>;
  listOrders(): Promise<Order[]>;
  placeOrder(itemId: string, qty: number): Promise<Order>;

  /** All cached mockups for a logo (keyed by a stable hash of its master SVG). */
  getMockups(logoKey: string): Promise<GeneratedMockups>;
  /** Persist one generated mockup so it is never regenerated for this logo. */
  saveMockup(logoKey: string, slot: string, image: string): Promise<void>;
}
