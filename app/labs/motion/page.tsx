// Thin route wrapper: everything for this lab lives under labs/motion/ so the
// main app’s code, routing and build are untouched. Internal R&D — noindex.

import type { Metadata } from "next";
import LabApp from "@/labs/motion/components/LabApp";

export const metadata: Metadata = {
  title: "Logo Motion Lab",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  return <LabApp />;
}
