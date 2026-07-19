import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import LabsAccessGate from "@/components/labs/LabsAccessGate";
import { labsEnabled } from "@/lib/labs-access";

// Hide every lab page in production unless LABS_ENABLED=1 (lib/labs-access).
export default function LabsLayout({ children }: { children: ReactNode }) {
  if (!labsEnabled()) notFound();
  return <LabsAccessGate>{children}</LabsAccessGate>;
}
