// Legacy URL: the motion lab moved when the lab constellation was created.
import { redirect } from "next/navigation";

export default function LegacyLabPage() {
  redirect("/labs/motion");
}
