// Thin route wrapper: everything for this lab lives under labs/generative/
// so the main app's code, routing and build are untouched. Internal R&D —
// noindex. This static route takes precedence over app/labs/[slug]
// (the placeholder page for planned labs).

import type { Metadata } from "next";
import GenerativeLabApp from "@/labs/generative/components/GenerativeLabApp";

export const metadata: Metadata = {
  title: "Generative Lab",
  robots: { index: false, follow: false },
};

export default function GenerativeLabPage() {
  return <GenerativeLabApp />;
}
