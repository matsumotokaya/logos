// Campaign Lab — the integration-mode lab: minimal sources in (URL / files /
// text, NotebookLM-style), marketing outputs out (Brand Kit → LP now, promo
// video next). This static route supersedes the planned-lab placeholder in
// app/labs/[slug] per the convention documented there.

import type { Metadata } from "next";
import { getLab } from "@/labs/directory";
import LabHeader from "@/labs/shared/components/LabHeader";
import CampaignStudio from "./CampaignStudio";

export const metadata: Metadata = {
  title: "Campaign Lab — 統合表現研究所",
  robots: { index: false, follow: false },
};

export default function CampaignLabPage() {
  const lab = getLab("campaign");

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <LabHeader
        current={lab && { name: lab.name, titleJa: lab.titleJa, mode: lab.mode }}
      />
      <CampaignStudio />
    </div>
  );
}
