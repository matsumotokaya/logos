import { recolorSvg } from "@/lib/svg";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import type { SceneProps, Variants } from "@/components/scenes/shared";

export function scenePropsFromLabLogo(logo: LabLogo): SceneProps {
  const svg = logo.svg ?? "";
  const variants: Variants = {
    white: svg ? recolorSvg(svg, "#F4F4F2") : "",
    black: svg ? recolorSvg(svg, "#101012") : "",
  };
  return {
    logo: {
      svg,
      viewBox: {
        x: logo.viewBox.x,
        y: logo.viewBox.y,
        w: logo.viewBox.w,
        h: logo.viewBox.h,
      },
      colors: logo.colors,
      anchors: [],
      handles: [],
    },
    name: logo.name,
    variants,
    mockupLogoId: logo.canonical ? logo.id : undefined,
    mockupCandidateId: logo.candidateId,
  };
}
