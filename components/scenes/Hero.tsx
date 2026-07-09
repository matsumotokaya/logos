import { svgToDataUri } from "@/lib/svg";
import type { SceneProps } from "./shared";

export default function Hero({ name, variants }: SceneProps) {
  return (
    <section className="flex min-h-dvh flex-col justify-between overflow-hidden bg-[#050505]">
      <p
        aria-hidden="true"
        className="-ml-[0.04em] select-none whitespace-nowrap text-[22vw] font-medium leading-[0.85] tracking-tight text-white"
      >
        {name}
      </p>

      <div className="flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgToDataUri(variants.white)}
          alt={`${name} logo`}
          className="h-[16vh] w-auto"
        />
      </div>

      <div className="flex justify-between px-6 pb-8 font-mono text-xs uppercase text-white/40 md:px-12">
        <p>©2026 {name.toUpperCase()}</p>
        <p>Brand Identity</p>
      </div>
    </section>
  );
}
