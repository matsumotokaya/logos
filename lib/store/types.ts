// Persistence contract. The UI only talks to this interface, so swapping
// localStorage for a real database (e.g. Supabase) later means implementing
// BrandRepo once and changing the export in lib/store/index.ts — nothing else.

import type { LogoData } from "@/lib/svg";

export type LogoRole = "brand" | "corporate" | "service" | "other";

export const LOGO_ROLE_LABELS: Record<LogoRole, string> = {
  brand: "ブランドロゴ",
  corporate: "コーポレートロゴ",
  service: "サービスロゴ",
  other: "その他",
};

export type StoredLogo = {
  id: string;
  title: string;
  role: LogoRole;
  data: LogoData;
  createdAt: string; // ISO 8601
};

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

export interface BrandRepo {
  getCompany(): Promise<Company>;
  saveCompany(company: Company): Promise<void>;

  listLogos(): Promise<StoredLogo[]>;
  getLogo(id: string): Promise<StoredLogo | null>;
  saveLogo(logo: StoredLogo): Promise<void>;
  updateLogo(id: string, patch: Partial<Pick<StoredLogo, "title" | "role">>): Promise<void>;
  deleteLogo(id: string): Promise<void>;

  listInventory(): Promise<InventoryItem[]>;
  listOrders(): Promise<Order[]>;
  placeOrder(itemId: string, qty: number): Promise<Order>;
}
