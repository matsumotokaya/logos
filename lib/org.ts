// Organization management (Supabase-only; the admin UI uses this when auth is
// enabled). Kept out of BrandRepo so the localStorage single-user mode stays
// simple. Mirrors docs/account-design.md §4 (roles) and §6 (transfer/handoff).

import { ensureSession, hasSupabase, supabase } from "@/lib/supabase/client";

export type OrgRole = "owner" | "admin" | "editor" | "purchaser" | "viewer";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  editor: "編集者",
  purchaser: "購買担当",
  viewer: "閲覧のみ",
};

/** Roles that may be assigned through the UI (owner is implicit / protected). */
export const ASSIGNABLE_ROLES: OrgRole[] = ["admin", "editor", "purchaser", "viewer"];

export type Organization = { id: string; name: string; myRole: OrgRole };
export type OrgMember = {
  userId: string;
  email: string | null;
  role: OrgRole;
  isMe: boolean;
};
export type OrgInvite = { id: string; email: string; role: OrgRole };

function throwOn(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function uid(): Promise<string> {
  const id = await ensureSession();
  if (!id) throw new Error("No Supabase session.");
  return id;
}

/** Organizations the current user belongs to, with their own role in each. */
export async function listMyOrgs(): Promise<Organization[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations ( org_id, name, created_at )")
    .eq("user_id", me);
  throwOn(error);
  type Row = {
    role: OrgRole;
    organizations: { org_id: string; name: string; created_at: string } | null;
  };
  return (data as unknown as Row[])
    .flatMap((r) =>
      r.organizations
        ? [{
            id: r.organizations.org_id,
            name: r.organizations.name,
            myRole: r.role,
            createdAt: r.organizations.created_at,
          }]
        : []
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, name, myRole }) => ({ id, name, myRole }));
}

export async function createOrganization(name: string): Promise<Organization> {
  const me = await uid();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, created_by: me })
    .select("org_id, name")
    .single();
  throwOn(error);
  // The 0002 trigger adds the creator as owner.
  return { id: data!.org_id, name: data!.name, myRole: "owner" };
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from("org_members")
    .select("user_id, role, users ( contact_email )")
    .eq("org_id", orgId);
  throwOn(error);
  type Row = { user_id: string; role: OrgRole; users: { contact_email: string | null } | null };
  const order: Record<OrgRole, number> = { owner: 0, admin: 1, editor: 2, purchaser: 3, viewer: 4 };
  return (data as unknown as Row[])
    .map((m) => ({
      userId: m.user_id,
      email: m.users?.contact_email ?? null,
      role: m.role,
      isMe: m.user_id === me,
    }))
    .sort((a, b) => order[a.role] - order[b.role]);
}

export async function listInvites(orgId: string): Promise<OrgInvite[]> {
  const { data, error } = await supabase
    .from("org_invites")
    .select("id, email, role")
    .eq("org_id", orgId)
    .order("created_at");
  throwOn(error);
  return (data ?? []) as OrgInvite[];
}

/**
 * Invite by email. If the person already has an account they join immediately;
 * otherwise a pending invite is stored and auto-accepted when they sign up
 * (0004 trigger). Returns whether the member joined now.
 */
export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgRole
): Promise<{ joined: boolean }> {
  const me = await uid();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("メールアドレスを入力してください。");

  const { data: existing, error: lookupErr } = await supabase
    .from("users")
    .select("user_id")
    .eq("contact_email", normalized)
    .maybeSingle();
  throwOn(lookupErr);

  if (existing) {
    const { error } = await supabase
      .from("org_members")
      .upsert({ org_id: orgId, user_id: existing.user_id, role }, { onConflict: "org_id,user_id" });
    throwOn(error);
    return { joined: true };
  }

  const { error } = await supabase
    .from("org_invites")
    .upsert({ org_id: orgId, email: normalized, role, invited_by: me }, { onConflict: "org_id,email" });
  throwOn(error);
  return { joined: false };
}

export async function setMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole
): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  throwOn(error);
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  throwOn(error);
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from("org_invites").delete().eq("id", inviteId);
  throwOn(error);
}

/**
 * Move a logo's ownership to an organization (personal → org, or org → org).
 * This is the buyout / handoff mechanism: created_by (credit) is untouched, and
 * the permalink never changes. The caller must be able to edit the logo now and
 * must admin the target org (enforced by RLS + checked in the UI).
 */
export async function transferLogoToOrg(logoId: string, orgId: string): Promise<void> {
  const me = await uid();
  const { error } = await supabase
    .from("logos")
    .update({ owner_org_id: orgId, owner_user_id: null, updated_by: me, updated_at: new Date().toISOString() })
    .eq("id", logoId);
  throwOn(error);
  await supabase
    .from("logo_activities")
    .insert({ logo_id: logoId, user_id: me, action: "transferred", detail: { to_org: orgId } });
}

export { hasSupabase };
