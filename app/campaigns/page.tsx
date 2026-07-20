// /campaigns — CM Maker's front door (see labs/campaign/README.md for the
// graduation decision). Intake + the bundled sample as the pre-filled
// placeholder; starting a generation navigates to /campaigns/[jobId], where
// the run lives. Each generated sales page keeps its canonical /c/[id] URL.

import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import { renderLandingPage } from "@/lib/campaign/render-lp";
import { sampleCampaignKit } from "@/lib/campaign/sample";
import CampaignsTop from "./CampaignsTop";

export const metadata: Metadata = {
  title: "Campaigns — CM Maker",
  robots: { index: false, follow: false },
};

export default function CampaignsPage() {
  const sampleHtml = renderLandingPage(sampleCampaignKit);

  return (
    <div className="relative min-h-dvh flex-1 bg-paper text-ink">
      {/* The header floats over the full-bleed hero; the hero clears it with top padding. */}
      <div className="absolute inset-x-0 top-0 z-30">
        <AppHeader section="Campaigns" tone="light" />
      </div>
      <CampaignsTop sampleHtml={sampleHtml} />
    </div>
  );
}
