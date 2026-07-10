"use client";

// Registered logo grid: role assignment, presentation link, deletion.

import Link from "next/link";
import { LOGO_ROLE_LABELS, type LogoRole, type StoredLogo } from "@/lib/store";
import { svgToDataUri } from "@/lib/svg";

type Props = {
  logos: StoredLogo[];
  onChangeRole: (id: string, role: LogoRole) => void;
  onDelete: (id: string) => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export default function LogoSection({ logos, onChangeRole, onDelete }: Props) {
  if (logos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-pretty text-sm text-gray-500">
          ロゴがまだありません。トップページからSVGをアップロードすると、ここに表示されます。
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm text-gray-900 underline underline-offset-2"
        >
          アップロードへ →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {logos.map((logo) => (
        <div key={logo.id} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex aspect-[4/3] items-center justify-center rounded-t-xl bg-[#F1F3F4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(logo.data.svg)}
              alt={logo.title}
              className="max-h-[55%] w-1/2 object-contain"
            />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium">{logo.title}</p>
              <p className="shrink-0 text-xs text-gray-400 tabular-nums">
                {formatDate(logo.createdAt)}
              </p>
            </div>
            <select
              aria-label="ロゴの役割"
              value={logo.role}
              onChange={(e) => onChangeRole(logo.id, e.target.value as LogoRole)}
              className="w-fit rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              {(Object.entries(LOGO_ROLE_LABELS) as [LogoRole, string][]).map(
                ([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                )
              )}
            </select>
            <div className="flex items-center justify-between">
              <a
                href={`/?logo=${logo.id}`}
                className="text-xs text-gray-900 underline underline-offset-2"
              >
                プレゼンを開く
              </a>
              <button
                type="button"
                onClick={() => onDelete(logo.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
