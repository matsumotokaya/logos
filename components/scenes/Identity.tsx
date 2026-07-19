"use client";

import { useState } from "react";
import { isDark } from "@/lib/color";
import { svgToDataUri } from "@/lib/svg";
import { rasterizeSvg } from "@/lib/raster";
import { useAuth } from "@/lib/auth";
import { generationErrorMessage, requestGeneration } from "@/lib/generate-client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import Reveal from "./Reveal";
import {
  Caption,
  EditableText,
  usePresentationEdit,
  type SceneProps,
} from "./shared";

type PlateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; image: string }
  | { status: "error"; message: string };

export default function Identity({ logo, name, variants }: SceneProps) {
  const { dict, format } = useI18n();
  const { isSignedIn } = useAuth();
  const { story, save } = usePresentationEdit();
  const [plate, setPlate] = useState<PlateState>({ status: "idle" });

  const primary = logo.colors[0].hex;
  // Fallback field: the brand's primary color when the white knockout reads
  // on it, otherwise the neutral dark artboard.
  const primaryIsDark = isDark(primary);
  const ratio = (logo.viewBox.h / logo.viewBox.w).toFixed(2);

  const generate = async () => {
    // Generation is a paid call gated to registered users server-side;
    // short-circuit here so guests get the message without an API call.
    if (!isSignedIn) {
      setPlate({ status: "error", message: dict.gen.signInRequired });
      return;
    }
    setPlate({ status: "loading" });
    try {
      const png = await rasterizeSvg(logo.svg, 1024, "#FFFFFF");
      const image = await requestGeneration({
        target: "wall",
        imageBase64: png.split(",")[1],
        brandName: name,
        primaryHex: primary,
      });
      setPlate({ status: "done", image });
    } catch (e) {
      setPlate({
        status: "error",
        message: generationErrorMessage(e, dict.gen),
      });
    }
  };

  const specs: { label: string; value: string; swatch?: string }[] = [
    { label: "Anchors", value: String(logo.anchors.length) },
    { label: "Colors", value: String(logo.colors.length) },
    { label: "Ratio", value: `1 : ${ratio}` },
    { label: "Primary", value: primary.toUpperCase(), swatch: primary },
    ...(logo.fileName ? [{ label: "File", value: logo.fileName }] : []),
  ];

  return (
    <section className="flex min-h-dvh flex-col bg-paper">
      {/* Image plate — white knockout on a photographic / generated field. */}
      <Reveal className="flex flex-1 items-center px-6 pt-8 md:px-12 md:pt-12">
        <div
          className={cn(
            "relative min-h-[44dvh] w-full overflow-hidden sm:min-h-[50dvh] lg:min-h-[58dvh]",
            !primaryIsDark && "bg-plate"
          )}
          style={primaryIsDark ? { backgroundColor: primary } : undefined}
          aria-busy={plate.status === "loading"}
        >
          {plate.status === "done" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plate.image}
              alt={`Generated scene: ${name} wall sign`}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {plate.status === "loading" && (
            <div className="absolute inset-0 animate-pulse bg-white/10" />
          )}
          <div className="absolute inset-0 flex items-center justify-center px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.white)}
              alt={name}
              className="max-h-[42%] w-[34%] object-contain"
            />
          </div>
          {plate.status !== "done" && (
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-3 md:bottom-6 md:left-6">
              <button
                type="button"
                onClick={generate}
                disabled={plate.status === "loading"}
                className="border border-white/25 px-4 py-1.5 font-mono text-[11px] uppercase text-white/80 transition-colors hover:border-white/60 hover:text-white disabled:pointer-events-none disabled:opacity-40"
              >
                {plate.status === "loading"
                  ? dict.gen.generating
                  : plate.status === "error"
                    ? dict.gen.retry
                    : dict.gen.scene}
              </button>
              <p aria-live="polite" className="font-mono text-[11px] text-white/60">
                {plate.status === "error" ? plate.message : ""}
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* Editorial text block. */}
      <Reveal className="px-6 pt-16 pb-14 md:px-12 md:pt-24 md:pb-20">
        <Caption n="01" title={dict.scenes.identity} tone="paper" />
        <h2 className="mt-6 max-w-3xl font-display text-4xl font-medium text-balance md:text-6xl">
          {dict.identity.title}
        </h2>
        <p className="mt-8 max-w-prose text-lg leading-relaxed text-pretty">
          {format(dict.identity.lead, {
            name,
            anchors: logo.anchors.length,
            colors: logo.colors.length,
          })}
        </p>
        {/* The brand story (layer B) replaces the generic body when written. */}
        <EditableText
          value={story}
          fallback={dict.identity.body}
          onSave={(next) => save({ story: next })}
          ariaLabel={dict.identity.title}
          className="mt-4 max-w-prose leading-relaxed text-pretty text-ink-muted"
        />
      </Reveal>

      {/* Spec strip. */}
      <div className="px-6 md:px-12">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-hairline py-6 sm:grid-cols-3 md:grid-cols-5">
          {specs.map(({ label, value, swatch }) => (
            <div key={label}>
              <dt className="font-mono text-[10px] uppercase text-ink-faint">
                {label}
              </dt>
              <dd className="mt-1.5 flex items-center gap-2 font-mono text-sm text-ink tabular-nums">
                {swatch && (
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 border border-hairline"
                    style={{ backgroundColor: swatch }}
                  />
                )}
                <span className="break-all">{value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
