// Thin route wrapper: everything for the lab lives under lab/ so the main
// app's code, routing and build are untouched. Internal R&D — noindex.

import type { Metadata } from "next";
import LabApp from "@/lab/components/LabApp";

export const metadata: Metadata = {
  title: "Logo Motion Lab",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  return <LabApp />;
}
