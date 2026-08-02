import { redirect } from "next/navigation";

// CM Maker's intake graduated to the top page. Keep this path as a redirect so
// old links (and any bookmarks) land on the new front door instead of 404ing.
export default function CampaignsPage() {
  redirect("/");
}
