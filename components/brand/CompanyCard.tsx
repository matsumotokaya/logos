"use client";

// Company profile editor card for the admin console.

import { useState } from "react";
import type { Company, StoredLogo } from "@/lib/store";
import { svgToDataUri } from "@/lib/svg";

type Props = {
  company: Company;
  primaryLogo: StoredLogo | null;
  onSave: (c: Company) => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

export default function CompanyCard({ company, primaryLogo, onSave }: Props) {
  const [draft, setDraft] = useState<Company>(company);
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<Company>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Logo preview tile */}
        <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F1F3F4]">
          {primaryLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={svgToDataUri(primaryLogo.data.svg)}
              alt={draft.name}
              className="max-h-[70%] max-w-[70%] object-contain"
            />
          ) : (
            <span className="text-[10px] text-gray-400">No logo</span>
          )}
        </div>

        {/* Profile form */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <label htmlFor="company-name" className="mb-1 block text-xs text-gray-500">
              会社名
            </label>
            <input
              id="company-name"
              type="text"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="company-industry" className="mb-1 block text-xs text-gray-500">
                業種
              </label>
              <input
                id="company-industry"
                type="text"
                value={draft.industry}
                onChange={(e) => set({ industry: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="company-location" className="mb-1 block text-xs text-gray-500">
                所在地
              </label>
              <input
                id="company-location"
                type="text"
                value={draft.location}
                onChange={(e) => set({ location: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="company-website" className="mb-1 block text-xs text-gray-500">
              Webサイト
            </label>
            <input
              id="company-website"
              type="text"
              value={draft.website}
              onChange={(e) => set({ website: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="company-description" className="mb-1 block text-xs text-gray-500">
              会社概要
            </label>
            <textarea
              id="company-description"
              rows={2}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              保存
            </button>
            {saved && <span className="text-xs text-green-600">保存しました</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
