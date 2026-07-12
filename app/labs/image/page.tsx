// Legacy URL: the deterministic-composition lab was renamed from Image Lab
// to Workflow Lab when the labs were reorganized into assurance/exploration
// modes ("Image" now belongs to the generative exploration side).
import { redirect } from "next/navigation";

export default function LegacyImageLabPage() {
  redirect("/labs/workflow");
}
