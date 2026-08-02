import AppHeader from "@/components/AppHeader";
import CampaignsTop from "@/app/campaigns/CampaignsTop";

// The top page is the front door of everything: add a source and get a brand,
// a sales page and a CM. It renders standalone (no management sidebar) with a
// transparent header that floats over the full-viewport hero, so the chrome
// blends into the landing rather than sitting in a solid bar.
export default function Home() {
  return (
    <div className="relative min-h-dvh">
      {/* Floating, transparent header over the dark hero. Not sticky: it
          scrolls away before the white content below comes into view. */}
      <div className="absolute inset-x-0 top-0 z-30">
        <AppHeader tone="light" />
      </div>
      <CampaignsTop />
    </div>
  );
}
