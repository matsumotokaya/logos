// Thin route wrapper: everything for this lab lives under labs/image/ so the
// main app’s code, routing and build are untouched. Internal R&D — noindex.

import type { Metadata } from "next";
import ImageLabApp from "@/labs/image/components/ImageLabApp";

export const metadata: Metadata = {
  title: "Image Lab",
  robots: { index: false, follow: false },
};

export default function ImageLabPage() {
  return <ImageLabApp />;
}
