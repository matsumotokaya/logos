// localStorage implementation of BrandRepo. Client-side only.
// All methods are async so a network-backed implementation is a drop-in swap.

import type { LogoData } from "@/lib/svg";
import {
  emptyPresentation,
  type BrandRepo,
  type Company,
  type GeneratedMockups,
  type InventoryItem,
  type LogoActivityAction,
  type LogoPatch,
  type LogoPresentation,
  type Order,
  type StoredLogo,
} from "./types";

const KEYS = {
  company: "logos.v1.company",
  logos: "logos.v1.logos",
  presentations: "logos.v1.presentations",
  inventory: "logos.v1.inventory",
  orders: "logos.v1.orders",
  mockups: "logos.v1.mockups",
} as const;

// logoKey -> { slot -> image }. Object insertion order doubles as LRU order.
type MockupMap = Record<string, GeneratedMockups>;

const DEFAULT_COMPANY: Company = {
  name: "",
  description: "",
  website: "",
  industry: "",
  location: "",
};

// Dummy inventory so the admin screen demonstrates the ordering business model.
// Shared with the Supabase implementation (seeded per organization).
export const SEED_INVENTORY: Omit<InventoryItem, "id">[] = [
  { name: "Tシャツ", spec: "ホワイト / シルクスクリーン / S-XL", category: "アパレル", emoji: "👕", unit: "枚", unitPrice: 1800, stock: 24, parLevel: 60, pendingQty: 0, lastOrderedAt: null },
  { name: "Tシャツ", spec: "ブラック / シルクスクリーン / S-XL", category: "アパレル", emoji: "👕", unit: "枚", unitPrice: 1800, stock: 51, parLevel: 60, pendingQty: 0, lastOrderedAt: null },
  { name: "パーカー", spec: "グレー / 刺繍 / M-XL", category: "アパレル", emoji: "🧥", unit: "枚", unitPrice: 4200, stock: 8, parLevel: 20, pendingQty: 0, lastOrderedAt: null },
  { name: "キャップ", spec: "ブラック / 刺繍", category: "アパレル", emoji: "🧢", unit: "個", unitPrice: 2400, stock: 15, parLevel: 30, pendingQty: 0, lastOrderedAt: null },
  { name: "マグカップ", spec: "マット / 330ml", category: "ドリンクウェア", emoji: "☕", unit: "個", unitPrice: 1200, stock: 6, parLevel: 40, pendingQty: 0, lastOrderedAt: null },
  { name: "タンブラー", spec: "ステンレス / 450ml", category: "ドリンクウェア", emoji: "🥤", unit: "個", unitPrice: 2800, stock: 32, parLevel: 30, pendingQty: 0, lastOrderedAt: null },
  { name: "トートバッグ", spec: "コットン / A4対応", category: "ノベルティ", emoji: "👜", unit: "個", unitPrice: 950, stock: 78, parLevel: 100, pendingQty: 0, lastOrderedAt: null },
  { name: "ステッカーセット", spec: "耐水 / 5種", category: "ノベルティ", emoji: "✨", unit: "セット", unitPrice: 350, stock: 210, parLevel: 300, pendingQty: 0, lastOrderedAt: null },
  { name: "ボールペン", spec: "メタル / レーザー刻印", category: "ノベルティ", emoji: "🖊️", unit: "本", unitPrice: 480, stock: 140, parLevel: 200, pendingQty: 0, lastOrderedAt: null },
  { name: "名刺", spec: "両面 / マット紙 / 100枚", category: "ステーショナリー", emoji: "📇", unit: "箱", unitPrice: 1600, stock: 12, parLevel: 25, pendingQty: 0, lastOrderedAt: null },
  { name: "封筒", spec: "長3 / ロゴ入り / 500枚", category: "ステーショナリー", emoji: "✉️", unit: "箱", unitPrice: 3800, stock: 4, parLevel: 10, pendingQty: 0, lastOrderedAt: null },
  { name: "クリアファイル", spec: "A4 / 片面印刷 / 100枚", category: "ステーショナリー", emoji: "📁", unit: "箱", unitPrice: 2200, stock: 9, parLevel: 15, pendingQty: 0, lastOrderedAt: null },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Entries saved before the canonical-record fields existed get defaults,
// so old localStorage data keeps working after the schema extension.
function normalizeLogo(raw: StoredLogo): StoredLogo {
  return {
    ...raw,
    updatedAt: raw.updatedAt ?? raw.createdAt,
    logoType: raw.logoType ?? null,
    parentId: raw.parentId ?? null,
    visibility: raw.visibility ?? "draft",
    credits: raw.credits ?? [],
    trademarks: raw.trademarks ?? [],
    activities: raw.activities ?? [],
    tags: raw.tags ?? [],
  };
}

export class LocalStorageRepo implements BrandRepo {
  async getCompany(): Promise<Company> {
    return read<Company>(KEYS.company, DEFAULT_COMPANY);
  }

  async saveCompany(company: Company): Promise<void> {
    write(KEYS.company, company);
  }

  async listLogos(): Promise<StoredLogo[]> {
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    return logos
      .map(normalizeLogo)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLogo(id: string): Promise<StoredLogo | null> {
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    const found = logos.find((l) => l.id === id);
    return found ? normalizeLogo(found) : null;
  }

  async saveLogo(logo: StoredLogo): Promise<void> {
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    const idx = logos.findIndex((l) => l.id === logo.id);
    if (idx >= 0) logos[idx] = logo;
    else logos.push(logo);
    write(KEYS.logos, logos);
  }

  async updateLogo(id: string, patch: LogoPatch): Promise<void> {
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    const idx = logos.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const before = normalizeLogo(logos[idx]);
    const now = new Date().toISOString();
    const action: LogoActivityAction =
      patch.visibility !== undefined && patch.visibility !== before.visibility
        ? "visibility_changed"
        : "info_updated";
    logos[idx] = {
      ...before,
      ...patch,
      updatedAt: now,
      activities: [...before.activities, { id: newId(), action, at: now }],
    };
    write(KEYS.logos, logos);
  }

  async replaceLogoData(id: string, data: LogoData): Promise<void> {
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    const idx = logos.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const before = normalizeLogo(logos[idx]);
    const now = new Date().toISOString();
    // Overwrite in place — no version is kept (docs/data-model.md §2.1).
    // The generated-mockup cache is keyed by SVG content, so replacing the
    // file naturally stops matching the old cache entries.
    logos[idx] = {
      ...before,
      data,
      updatedAt: now,
      activities: [
        ...before.activities,
        { id: newId(), action: "file_updated", at: now },
      ],
    };
    write(KEYS.logos, logos);
  }

  async deleteLogo(id: string): Promise<void> {
    const remaining = read<StoredLogo[]>(KEYS.logos, [])
      .filter((l) => l.id !== id)
      // Children of the deleted logo become roots instead of dangling.
      .map((l) => (l.parentId === id ? { ...l, parentId: null } : l));
    write(KEYS.logos, remaining);
    const presentations = read<Record<string, LogoPresentation>>(
      KEYS.presentations,
      {}
    );
    if (id in presentations) {
      delete presentations[id];
      write(KEYS.presentations, presentations);
    }
  }

  async getPresentation(logoId: string): Promise<LogoPresentation> {
    const map = read<Record<string, LogoPresentation>>(KEYS.presentations, {});
    return map[logoId] ?? emptyPresentation();
  }

  async savePresentation(
    logoId: string,
    presentation: LogoPresentation
  ): Promise<void> {
    const map = read<Record<string, LogoPresentation>>(KEYS.presentations, {});
    const now = new Date().toISOString();
    map[logoId] = { ...presentation, updatedAt: now };
    write(KEYS.presentations, map);

    // Record the edit in the logo's work history.
    const logos = read<StoredLogo[]>(KEYS.logos, []);
    const idx = logos.findIndex((l) => l.id === logoId);
    if (idx < 0) return;
    const before = normalizeLogo(logos[idx]);
    logos[idx] = {
      ...before,
      updatedAt: now,
      activities: [
        ...before.activities,
        { id: newId(), action: "presentation_updated", at: now },
      ],
    };
    write(KEYS.logos, logos);
  }

  async listInventory(): Promise<InventoryItem[]> {
    let items = read<InventoryItem[] | null>(KEYS.inventory, null);
    if (!items) {
      items = SEED_INVENTORY.map((item) => ({ ...item, id: newId() }));
      write(KEYS.inventory, items);
    }
    return items;
  }

  async listOrders(): Promise<Order[]> {
    const orders = read<Order[]>(KEYS.orders, []);
    return [...orders].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  }

  async placeOrder(itemId: string, qty: number): Promise<Order> {
    const items = await this.listInventory();
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("アイテムが見つかりません。");
    if (qty <= 0) throw new Error("数量は1以上を指定してください。");

    const now = new Date().toISOString();
    item.pendingQty += qty;
    item.lastOrderedAt = now;
    write(KEYS.inventory, items);

    const order: Order = {
      id: newId(),
      itemId: item.id,
      itemName: `${item.name}(${item.spec})`,
      qty,
      amount: qty * item.unitPrice,
      status: "ordered",
      orderedAt: now,
    };
    const orders = read<Order[]>(KEYS.orders, []);
    orders.push(order);
    write(KEYS.orders, orders);
    return order;
  }

  async getMockups(logoKey: string): Promise<GeneratedMockups> {
    const map = read<MockupMap>(KEYS.mockups, {});
    return map[logoKey] ?? {};
  }

  async saveMockup(
    logoKey: string,
    slot: string,
    image: string
  ): Promise<void> {
    if (typeof window === "undefined") return;
    const map = read<MockupMap>(KEYS.mockups, {});
    // Re-insert this logo last so it counts as most-recently-used.
    const entry = { ...(map[logoKey] ?? {}), [slot]: image };
    delete map[logoKey];
    map[logoKey] = entry;

    // Images are large; if the quota is hit, evict the least-recently-used
    // logos (oldest keys first) and retry until it fits or only this one is left.
    const keys = Object.keys(map);
    let evict = 0;
    for (;;) {
      try {
        window.localStorage.setItem(KEYS.mockups, JSON.stringify(map));
        return;
      } catch {
        if (evict >= keys.length - 1) return; // can't shrink further
        delete map[keys[evict]];
        evict += 1;
      }
    }
  }
}
