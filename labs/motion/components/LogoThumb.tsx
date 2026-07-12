"use client";

// Static logo rendering (the "at rest" look). Used for card idle state and
// the logo rail. SVG markup is baked and script-stripped by the analyzer.

import { cn } from "@/lib/cn";
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
  return (
    <div
      aria-label={logo.name}
      className={cn("h-full w-full [&_svg]:h-full [&_svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: logo.svg ?? "" }}
    />
  );
}
