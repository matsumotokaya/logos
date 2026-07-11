// Supabase implementation of BrandRepo (schema: supabase/migrations/).
// Client-side only, like LocalStorageRepo: every method ensures an auth
// session first — guests get an anonymous session (docs/account-design.md §1),
// which later upgrades to a permanent account with the same user_id.

import { ensureSession, supabase } from "@/lib/supabase/client";
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
import { SEED_INVENTORY } from "./local";

// ---------------------------------------------------------------------------
// Row ↔ app-type mapping

type LogoRow = {
  id: string;
  title: string;
  role: StoredLogo["role"];
  logo_type: StoredLogo["logoType"];
  parent_logo_id: string | null;
  visibility: StoredLogo["visibility"];
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  logo_candidates: {
    id: string;
    is_primary: boolean;
    svg: string;
    analysis: Omit<LogoData, "svg"> | null;
  }[];
  logo_credits: { id: string; role: string; name: string; contact: string }[];
  logo_trademarks: {
    id: string;
    status: string;
    jurisdiction: string;
    registration_no: string;
    trademark_type: string | null;
    nice_classes: number[];
    goods_services: string;
  }[];
  logo_activities: { id: string; action: string; created_at: string }[];
  logo_tags: { tags: { name: string } | null }[];
};

const LOGO_SELECT = `
  id, title, role, logo_type, parent_logo_id, visibility, owner_user_id, created_at, updated_at,
  logo_candidates ( id, is_primary, svg, analysis ),
  logo_credits ( id, role, name, contact ),
  logo_trademarks ( id, status, jurisdiction, registration_no, trademark_type, nice_classes, goods_services ),
  logo_activities ( id, action, created_at ),
  logo_tags ( tags ( name ) )
`;

function rowToStoredLogo(row: LogoRow, currentUserId: string | null): StoredLogo | null {
  const primary =
    row.logo_candidates.find((c) => c.is_primary) ?? row.logo_candidates[0];
  if (!primary) return null; // defensive: a logo without a master file
  const data = { ...(primary.analysis ?? {}), svg: primary.svg } as LogoData;
  return {
    id: row.id,
    title: row.title,
    role: row.role,
    data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    logoType: row.logo_type,
    parentId: row.parent_logo_id,
    visibility: row.visibility,
    // UI gate only — writes are also enforced by RLS server-side. Org-owned
    // logos will extend this once org membership drives editing.
    canEdit: row.owner_user_id !== null && row.owner_user_id === currentUserId,
    credits: row.logo_credits.map((c) => ({
      id: c.id,
      role: c.role as StoredLogo["credits"][number]["role"],
      name: c.name,
      contact: c.contact,
    })),
    trademarks: row.logo_trademarks.map((t) => ({
      id: t.id,
      status: t.status as StoredLogo["trademarks"][number]["status"],
      jurisdiction: t.jurisdiction,
      registrationNo: t.registration_no,
      trademarkType:
        t.trademark_type as StoredLogo["trademarks"][number]["trademarkType"],
      niceClasses: t.nice_classes,
      goodsServices: t.goods_services,
    })),
    activities: [...row.logo_activities]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) => ({
        id: a.id,
        action: a.action as LogoActivityAction,
        at: a.created_at,
      })),
    tags: row.logo_tags.flatMap((lt) => (lt.tags ? [lt.tags.name] : [])),
  };
}

function splitLogoData(data: LogoData): {
  svg: string;
  analysis: Omit<LogoData, "svg">;
} {
  const { svg, ...analysis } = data;
  return { svg, analysis };
}

function throwOn(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseRepo implements BrandRepo {
  /** Resolve the current user id, signing in anonymously on first contact. */
  private async ensureAuth(): Promise<string> {
    const id = await ensureSession();
    if (!id) throw new Error("No Supabase session.");
    return id;
  }

  /**
   * The user's organization (auto-created on first use; the creator becomes
   * owner via the 0002 trigger). Company profile, inventory and orders hang
   * off it — the same shape the real multi-tenant phase will use.
   */
  private async ensureOrg(): Promise<string> {
    const uid = await this.ensureAuth();
    const { data, error } = await supabase
      .from("organizations")
      .select("org_id")
      .order("created_at")
      .limit(1);
    throwOn(error);
    if (data && data.length > 0) return data[0].org_id as string;
    const { data: created, error: insErr } = await supabase
      .from("organizations")
      .insert({ name: "", created_by: uid })
      .select("org_id")
      .single();
    throwOn(insErr);
    return created!.org_id as string;
  }

  private async logActivity(
    logoId: string,
    action: LogoActivityAction
  ): Promise<void> {
    const uid = await this.ensureAuth();
    await supabase
      .from("logo_activities")
      .insert({ logo_id: logoId, user_id: uid, action });
  }

  // ---------- company (organization profile) ----------

  async getCompany(): Promise<Company> {
    const orgId = await this.ensureOrg();
    const { data, error } = await supabase
      .from("organizations")
      .select("name, description, website, industry, location")
      .eq("org_id", orgId)
      .single();
    throwOn(error);
    return {
      name: data!.name ?? "",
      description: data!.description ?? "",
      website: data!.website ?? "",
      industry: data!.industry ?? "",
      location: data!.location ?? "",
    };
  }

  async saveCompany(company: Company): Promise<void> {
    const orgId = await this.ensureOrg();
    const { error } = await supabase
      .from("organizations")
      .update(company)
      .eq("org_id", orgId);
    throwOn(error);
  }

  // ---------- logos ----------

  async listLogos(): Promise<StoredLogo[]> {
    const uid = await this.ensureAuth();
    // Owned logos only. RLS also grants SELECT on every unlisted/public logo
    // (for permalinks and the future public directory), so without this filter
    // the personal gallery and admin would show other people's logos.
    // Org-owned logos join here once org ownership lands (Step 5).
    const { data, error } = await supabase
      .from("logos")
      .select(LOGO_SELECT)
      .eq("owner_user_id", uid)
      .order("created_at", { ascending: false });
    throwOn(error);
    return (data as unknown as LogoRow[]).flatMap((row) => {
      const logo = rowToStoredLogo(row, uid);
      return logo ? [logo] : [];
    });
  }

  async getLogo(id: string): Promise<StoredLogo | null> {
    const uid = await this.ensureAuth();
    const { data, error } = await supabase
      .from("logos")
      .select(LOGO_SELECT)
      .eq("id", id)
      .maybeSingle();
    throwOn(error);
    return data ? rowToStoredLogo(data as unknown as LogoRow, uid) : null;
  }

  async saveLogo(logo: StoredLogo): Promise<void> {
    const uid = await this.ensureAuth();
    const { error } = await supabase.from("logos").insert({
      id: logo.id,
      owner_user_id: uid,
      created_by: uid,
      title: logo.title,
      role: logo.role,
      visibility: logo.visibility,
      updated_by: uid,
    });
    throwOn(error);
    const { svg, analysis } = splitLogoData(logo.data);
    const { error: candErr } = await supabase.from("logo_candidates").insert({
      logo_id: logo.id,
      label: "A",
      is_primary: true,
      svg,
      analysis,
    });
    throwOn(candErr);
    await this.logActivity(logo.id, "created");
  }

  async updateLogo(id: string, patch: LogoPatch): Promise<void> {
    const uid = await this.ensureAuth();

    const row: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: uid };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.logoType !== undefined) row.logo_type = patch.logoType;
    if (patch.parentId !== undefined) row.parent_logo_id = patch.parentId;

    let action: LogoActivityAction = "info_updated";
    if (patch.visibility !== undefined) {
      row.visibility = patch.visibility;
      action = "visibility_changed";
    }
    const { error } = await supabase.from("logos").update(row).eq("id", id);
    throwOn(error);

    // Credits / trademarks / tags are replaced as whole sets — same semantics
    // as the localStorage implementation.
    if (patch.credits !== undefined) {
      throwOn((await supabase.from("logo_credits").delete().eq("logo_id", id)).error);
      if (patch.credits.length > 0) {
        throwOn(
          (
            await supabase.from("logo_credits").insert(
              patch.credits.map((c) => ({
                logo_id: id,
                role: c.role,
                name: c.name,
                contact: c.contact,
              }))
            )
          ).error
        );
      }
    }
    if (patch.trademarks !== undefined) {
      throwOn((await supabase.from("logo_trademarks").delete().eq("logo_id", id)).error);
      if (patch.trademarks.length > 0) {
        throwOn(
          (
            await supabase.from("logo_trademarks").insert(
              patch.trademarks.map((t) => ({
                logo_id: id,
                status: t.status,
                jurisdiction: t.jurisdiction,
                registration_no: t.registrationNo,
                trademark_type: t.trademarkType,
                nice_classes: t.niceClasses,
                goods_services: t.goodsServices,
              }))
            )
          ).error
        );
      }
    }
    if (patch.tags !== undefined) {
      const names = patch.tags.map((t) => t.trim()).filter(Boolean);
      throwOn((await supabase.from("logo_tags").delete().eq("logo_id", id)).error);
      if (names.length > 0) {
        const { data: tagRows, error: tagErr } = await supabase
          .from("tags")
          .upsert(names.map((name) => ({ name })), { onConflict: "name" })
          .select("id, name");
        throwOn(tagErr);
        throwOn(
          (
            await supabase
              .from("logo_tags")
              .insert(tagRows!.map((t) => ({ logo_id: id, tag_id: t.id })))
          ).error
        );
      }
    }

    await this.logActivity(id, action);
  }

  async replaceLogoData(id: string, data: LogoData): Promise<void> {
    await this.ensureAuth();
    const { svg, analysis } = splitLogoData(data);
    const { error } = await supabase
      .from("logo_candidates")
      .update({ svg, analysis, updated_at: new Date().toISOString() })
      .eq("logo_id", id)
      .eq("is_primary", true);
    throwOn(error);
    await this.logActivity(id, "file_updated");
  }

  async deleteLogo(id: string): Promise<void> {
    await this.ensureAuth();
    // Children and presentation cascade; child logos' parent_logo_id is
    // cleared by the FK's on delete set null.
    const { error } = await supabase.from("logos").delete().eq("id", id);
    throwOn(error);
  }

  // ---------- presentation (layer B) ----------

  async getPresentation(logoId: string): Promise<LogoPresentation> {
    await this.ensureAuth();
    const { data, error } = await supabase
      .from("logo_presentations")
      .select("catchphrase, story, scene_texts, updated_at")
      .eq("logo_id", logoId)
      .maybeSingle();
    throwOn(error);
    if (!data) return emptyPresentation();
    return {
      catchphrase: data.catchphrase,
      story: data.story,
      sceneTexts: data.scene_texts ?? {},
      updatedAt: data.updated_at,
    };
  }

  async savePresentation(
    logoId: string,
    presentation: LogoPresentation
  ): Promise<void> {
    await this.ensureAuth();
    const { error } = await supabase.from("logo_presentations").upsert({
      logo_id: logoId,
      catchphrase: presentation.catchphrase,
      story: presentation.story,
      scene_texts: presentation.sceneTexts,
      updated_at: new Date().toISOString(),
    });
    throwOn(error);
    await this.logActivity(logoId, "presentation_updated");
  }

  // ---------- inventory / orders (org-scoped) ----------

  async listInventory(): Promise<InventoryItem[]> {
    const orgId = await this.ensureOrg();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("org_id", orgId)
      .order("name");
    throwOn(error);
    if (data && data.length > 0) return data.map(mapInventoryRow);

    // First visit: seed the demo inventory for this organization.
    const { data: seeded, error: seedErr } = await supabase
      .from("inventory_items")
      .insert(
        SEED_INVENTORY.map((item) => ({
          org_id: orgId,
          name: item.name,
          spec: item.spec,
          category: item.category,
          emoji: item.emoji,
          unit: item.unit,
          unit_price: item.unitPrice,
          stock: item.stock,
          par_level: item.parLevel,
          pending_qty: item.pendingQty,
        }))
      )
      .select("*");
    throwOn(seedErr);
    return (seeded ?? []).map(mapInventoryRow);
  }

  async listOrders(): Promise<Order[]> {
    const orgId = await this.ensureOrg();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("org_id", orgId)
      .order("ordered_at", { ascending: false });
    throwOn(error);
    return (data ?? []).map((o) => ({
      id: o.id,
      itemId: o.item_id,
      itemName: o.item_name,
      qty: o.qty,
      amount: o.amount,
      status: o.status,
      orderedAt: o.ordered_at,
    }));
  }

  async placeOrder(itemId: string, qty: number): Promise<Order> {
    const orgId = await this.ensureOrg();
    const uid = await this.ensureAuth();
    if (qty <= 0) throw new Error("数量は1以上を指定してください。");
    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .single();
    throwOn(itemErr);

    const now = new Date().toISOString();
    throwOn(
      (
        await supabase
          .from("inventory_items")
          .update({ pending_qty: item!.pending_qty + qty, last_ordered_at: now })
          .eq("id", itemId)
      ).error
    );
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        org_id: orgId,
        item_id: itemId,
        item_name: `${item!.name}（${item!.spec}）`,
        qty,
        amount: qty * item!.unit_price,
        status: "ordered",
        ordered_by: uid,
      })
      .select("*")
      .single();
    throwOn(orderErr);
    return {
      id: order!.id,
      itemId: order!.item_id,
      itemName: order!.item_name,
      qty: order!.qty,
      amount: order!.amount,
      status: order!.status,
      orderedAt: order!.ordered_at,
    };
  }

  // ---------- generated mockups ----------
  // The app keys mockups by a content hash of the master SVG. Images live in
  // the public "mockups" Storage bucket under <logoKey>/<slot>.png; the DB
  // table logo_mockups (candidate-keyed) will take over when candidates get
  // their own UI. Values returned are public URLs (usable as <img src>).

  async getMockups(logoKey: string): Promise<GeneratedMockups> {
    await this.ensureAuth();
    const { data, error } = await supabase.storage.from("mockups").list(logoKey);
    if (error || !data) return {};
    const result: GeneratedMockups = {};
    for (const file of data) {
      const slot = file.name.replace(/\.[^.]+$/, "");
      const { data: pub } = supabase.storage
        .from("mockups")
        .getPublicUrl(`${logoKey}/${file.name}`);
      result[slot] = pub.publicUrl;
    }
    return result;
  }

  async saveMockup(logoKey: string, slot: string, image: string): Promise<void> {
    await this.ensureAuth();
    const blob = await (await fetch(image)).blob();
    await supabase.storage
      .from("mockups")
      .upload(`${logoKey}/${slot}.png`, blob, {
        contentType: blob.type || "image/png",
        upsert: true,
      });
  }
}

function mapInventoryRow(row: {
  id: string;
  name: string;
  spec: string;
  category: string;
  emoji: string;
  unit: string;
  unit_price: number;
  stock: number;
  par_level: number;
  pending_qty: number;
  last_ordered_at: string | null;
}): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    spec: row.spec,
    category: row.category as InventoryItem["category"],
    emoji: row.emoji,
    unit: row.unit,
    unitPrice: row.unit_price,
    stock: row.stock,
    parLevel: row.par_level,
    pendingQty: row.pending_qty,
    lastOrderedAt: row.last_ordered_at,
  };
}
