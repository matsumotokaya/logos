"use client";

// Organization members & roles (Supabase mode only). Owner/admin can invite by
// email, change roles and remove members; everyone else sees a read-only roster.

import { useEffect, useState } from "react";
import {
  ASSIGNABLE_ROLES,
  ORG_ROLE_LABELS,
  cancelInvite,
  inviteMember,
  listInvites,
  listMembers,
  removeMember,
  setMemberRole,
  type OrgInvite,
  type OrgMember,
  type OrgRole,
  type Organization,
} from "@/lib/org";

const inputCls =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none";

export default function OrgSection({ org }: { org: Organization }) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("editor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = org.myRole === "owner" || org.myRole === "admin";

  const load = async () => {
    const [m, i] = await Promise.all([
      listMembers(org.id),
      canManage ? listInvites(org.id) : Promise.resolve([]),
    ]);
    return { m, i };
  };
  const refresh = async () => {
    const { m, i } = await load();
    setMembers(m);
    setInvites(i);
  };

  useEffect(() => {
    let cancelled = false;
    void load().then(({ m, i }) => {
      if (cancelled) return;
      setMembers(m);
      setInvites(i);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const { joined } = await inviteMember(org.id, email, role);
      setEmail("");
      setMsg(joined ? "メンバーを追加しました。" : "招待を保存しました。相手が登録すると自動で参加します。");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "招待に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, next: OrgRole) => {
    await setMemberRole(org.id, userId, next);
    await refresh();
  };

  const remove = async (userId: string, label: string) => {
    if (!window.confirm(`${label} を組織から外しますか？`)) return;
    await removeMember(org.id, userId);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-gray-500">
          あなたの権限:{" "}
          <span className="font-medium text-gray-900">{ORG_ROLE_LABELS[org.myRole]}</span>
        </p>
      </div>

      {/* Members */}
      <ul className="flex flex-col divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 truncate text-sm">
              {m.email ?? "（メール未確定）"}
              {m.isMe && <span className="ml-2 text-xs text-gray-400">あなた</span>}
            </span>
            {canManage && m.role !== "owner" && !m.isMe ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`${m.email ?? m.userId} の権限`}
                  value={m.role}
                  onChange={(e) => void changeRole(m.userId, e.target.value as OrgRole)}
                  className={inputCls}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ORG_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void remove(m.userId, m.email ?? m.userId)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  外す
                </button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-gray-500">{ORG_ROLE_LABELS[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-gray-500">招待中</p>
          <ul className="flex flex-col divide-y divide-gray-100">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-600">
                  {i.email}
                  <span className="ml-2 text-xs text-gray-400">{ORG_ROLE_LABELS[i.role]}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await cancelInvite(i.id);
                    await refresh();
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  取消
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form */}
      {canManage && (
        <form onSubmit={invite} className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500">メンバーを招待</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              aria-label="招待するメールアドレス"
              className={`${inputCls} flex-1`}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              aria-label="招待する権限"
              className={inputCls}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ORG_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              招待
            </button>
          </div>
          {msg && <p className="text-pretty text-xs text-gray-600">{msg}</p>}
          {error && <p className="text-pretty text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
