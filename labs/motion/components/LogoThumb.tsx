"use client";

// Static logo rendering (the "at rest" look). Used for card idle state and
// the logo rail. Rendered via <img> + data URI so SVG markup can never run
// script in the page, even if a raw (unsanitized) SVG reaches the registry.

import { cn } from "@/lib/cn";
import { svgToDataUri } from "@/lib/svg";
import type { LabLogo } from "@/labs/motion/core/experiment-api";

export default function LogoThumb({
  logo,
  className,
}: {
  logo: LabLogo;
  className?: string;
}) {
  if (logo.kind === "png" && logo.pngDataUri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.pngDataUri}
        alt={logo.name}
        className={cn("h-full w-full object-contain", className)}
      />
    );
  }
  if (!logo.svg) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={svgToDataUri(logo.svg)}
      alt={logo.name}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
