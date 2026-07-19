"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

type DeletionPreview = {
  personalLogoCount: number;
  deletedOrganizationCount: number;
  deletedOrganizationLogoCount: number;
  retainedOrganizationCount: number;
  r2ObjectCount: number;
  blockingOrganizations: Array<{ id: string; name: string }>;
};

async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("ログイン情報を確認できませんでした。");
  return token;
}

async function accountRequest(
  method: "GET" | "DELETE",
  confirmation?: string,
): Promise<Response> {
  const token = await accessToken();
  return fetch("/api/account", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "DELETE" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "DELETE" ? JSON.stringify({ confirmation }) : undefined,
    cache: "no-store",
  });
}

export default function DeleteAccountSection() {
  const { enabled, loading: authLoading, user, isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRequestId = useRef(0);

  const expectedConfirmation = user?.email ?? "DELETE";
  const confirmationMatches =
    confirmation.trim().toLowerCase() === expectedConfirmation.trim().toLowerCase();
  const blocked = Boolean(preview?.blockingOrganizations.length);
  const canOpen = enabled && !authLoading && isSignedIn;
  const canDelete =
    Boolean(preview) && !previewLoading && !blocked && confirmationMatches && !busy;

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;

    if (!nextOpen) {
      setPreview(null);
      setConfirmation("");
      setError(null);
      return;
    }

    setPreviewLoading(true);
    setError(null);
    void accountRequest("GET")
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | (DeletionPreview & { error?: string })
          | null;
        if (!response.ok || !body) {
          throw new Error(body?.error || "削除対象を確認できませんでした。");
        }
        if (previewRequestId.current === requestId) setPreview(body);
      })
      .catch((requestError: unknown) => {
        if (previewRequestId.current === requestId) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "削除対象を確認できませんでした。",
          );
        }
      })
      .finally(() => {
        if (previewRequestId.current === requestId) setPreviewLoading(false);
      });
  };

  const deleteAccount = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const response = await accountRequest("DELETE", confirmation);
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "アカウントを削除できませんでした。");
      }
      // The Auth user no longer exists, so clear the browser session locally;
      // AuthProvider creates a fresh anonymous session after the redirect.
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "アカウントを削除できませんでした。",
      );
      setBusy(false);
    }
  };

  const unavailableNote = !enabled
    ? "localStorageモードには削除対象のアカウントがありません。"
    : authLoading
      ? "アカウント情報を確認しています。"
      : !isSignedIn
        ? "退会するには登録アカウントでログインしてください。"
        : null;

  return (
    <section className="border border-red-200 bg-white p-5">
      <h2 className="text-balance text-sm font-semibold text-gray-900">退会</h2>
      <p className="mt-1 text-pretty text-xs text-gray-600">
        個人所有のロゴ、プレゼン、生成物、アカウント情報を完全に削除します。組織所有のロゴは組織に残ります。
      </p>

      <div className="mt-4">
        <AlertDialog.Root open={open} onOpenChange={changeOpen}>
          <AlertDialog.Trigger
            disabled={!canOpen}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
          >
            アカウントを削除
          </AlertDialog.Trigger>

          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
            <AlertDialog.Viewport
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
              style={{
                paddingTop: "max(1rem, env(safe-area-inset-top))",
                paddingRight: "max(1rem, env(safe-area-inset-right))",
                paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                paddingLeft: "max(1rem, env(safe-area-inset-left))",
              }}
            >
              <AlertDialog.Popup
                aria-busy={busy || previewLoading}
                className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl focus:outline-none"
              >
                <AlertDialog.Title className="text-balance text-lg font-semibold text-gray-950">
                  アカウントを完全に削除しますか？
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-pretty text-sm text-gray-600">
                  この操作は取り消せません。削除後は同じアカウントや共有URLを復元できません。
                </AlertDialog.Description>

                {previewLoading ? (
                  <p className="mt-5 text-sm text-gray-600" role="status" aria-live="polite">
                    削除対象を確認しています…
                  </p>
                ) : preview ? (
                  <div className="mt-5 rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-900">削除されるデータ</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-pretty text-sm text-gray-700">
                      <li>個人所有ロゴ {preview.personalLogoCount}件と、そのプレゼン・生成物</li>
                      <li>
                        本人だけが所属する組織 {preview.deletedOrganizationCount}件と、その組織所有ロゴ {preview.deletedOrganizationLogoCount}件
                      </li>
                      <li>認証情報、プロフィール、ブックマーク、生成履歴</li>
                    </ul>
                    {preview.retainedOrganizationCount > 0 ? (
                      <p className="mt-3 text-pretty text-xs text-gray-600">
                        共同組織 {preview.retainedOrganizationCount}件と、その組織所有ロゴは残ります。あなたのメンバー資格だけが削除されます。
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {blocked && preview ? (
                  <div className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-gray-700">
                    <p className="text-pretty font-medium">
                      次の組織には他のオーナーがいないため、退会できません。
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {preview.blockingOrganizations.map((org) => (
                        <li key={org.id}>{org.name || "名称未設定の組織"}</li>
                      ))}
                    </ul>
                    <Link
                      href="/brand"
                      className="mt-2 inline-block font-medium text-gray-950 underline underline-offset-2"
                    >
                      Brand Managerで別のオーナーを設定する
                    </Link>
                  </div>
                ) : null}

                <div className="mt-5">
                  <label htmlFor="delete-account-confirmation" className="text-sm font-medium text-gray-900">
                    確認のため「{expectedConfirmation}」と入力
                  </label>
                  <input
                    id="delete-account-confirmation"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    aria-describedby="delete-account-help delete-account-error"
                    aria-invalid={error?.includes("確認入力") ? true : undefined}
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-red-700 focus:outline-none focus:ring-1 focus:ring-red-700"
                  />
                  <p id="delete-account-help" className="mt-1 text-pretty text-xs text-gray-500">
                    入力が一致するまで削除ボタンは有効になりません。
                  </p>
                  <p
                    id="delete-account-error"
                    className="mt-2 min-h-4 text-pretty text-xs text-red-700"
                    role={error ? "alert" : undefined}
                  >
                    {error}
                  </p>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <AlertDialog.Close
                    disabled={busy}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:opacity-50"
                  >
                    キャンセル
                  </AlertDialog.Close>
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => void deleteAccount()}
                    className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {busy ? "削除しています…" : "完全に削除する"}
                  </button>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Viewport>
          </AlertDialog.Portal>
        </AlertDialog.Root>

        {unavailableNote ? (
          <p className="mt-2 text-pretty text-xs text-gray-500">{unavailableNote}</p>
        ) : null}
      </div>
    </section>
  );
}
