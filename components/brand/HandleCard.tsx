"use client";

// Org vanity handle (Supabase mode only). Owner/admin can claim or change the
// handle backing /{handle}/{slug} URLs; other roles see a read-only display.

import { useEffect, useState } from "react";
import { claimOrgHandle, getOrgHandle, type Organization } from "@/lib/org";

const inputCls =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none";

export default function HandleCard({ org }: { org: Organization }) {
  const [handle, setHandle] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = org.myRole === "owner" || org.myRole === "admin";

  useEffect(() => {
    let cancelled = false;
    void getOrgHandle(org.id).then((h) => {
      if (cancelled) return;
      setHandle(h);
      setDraft(h ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const saved = await claimOrgHandle(org.id, draft);
      setHandle(saved);
      setDraft(saved);
      setMsg("保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">
        現在のハンドル:{" "}
        {handle ? (
          <span className="font-medium text-gray-900">{handle}</span>
        ) : (
          <span className="text-gray-400">未設定</span>
        )}
      </p>
      {handle && (
        <p className="text-xs text-gray-500">例: /{handle}/ロゴのスラッグ</p>
      )}

      {canManage ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="my-company"
            aria-label="組織のハンドル"
            className={`${inputCls} w-56`}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            保存
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-400">
          ハンドルの変更はオーナー／管理者のみ行えます。
        </p>
      )}
      {msg && <p className="text-pretty text-xs text-gray-600">{msg}</p>}
      {error && <p className="text-pretty text-xs text-red-600">{error}</p>}

      <p className="text-pretty text-xs text-gray-400">
        公開(public)のロゴにスラッグを設定すると /ハンドル/スラッグ
        でプレゼンを共有できます。スラッグはロゴ情報ページで設定します。
      </p>
    </div>
  );
}
