// Thin route wrapper: everything for this lab lives under labs/workflow/ so the
// main app’s code, routing and build are untouched. Internal R&D — noindex.

import type { Metadata } from "next";
import WorkflowLabApp from "@/labs/workflow/components/WorkflowLabApp";

export const metadata: Metadata = {
  title: "Workflow Lab",
  robots: { index: false, follow: false },
};

export default function ImageLabPage() {
  return <WorkflowLabApp />;
}
