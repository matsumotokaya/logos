"use client";

import { svgToDataUri, outlineSvg } from "@/lib/svg";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, type SceneProps } from "./shared";

// Every mark of a normal logo is drawn. Only pathological files (tens of
// thousands of points) reach this DOM-node ceiling — an anchor costs 1 node,
// a handle 2 (line + control circle) — that keeps the browser from choking on,
// say, a 100k-point trace. Well above any real logo (the dense "BOMB squad"
// sample is ~16k nodes), so in practice nothing is dropped.
const MAX_NODES = 24000;

// Drafting marks on the white sheet, all derived from the ink scale.
const GRID_LINE = "rgba(16,16,18,0.05)";
const HANDLE_LINE = "rgba(16,16,18,0.28)";

// Take at most `max` items spread evenly across the array, so when the ceiling
// bites the whole mark stays represented instead of being cut off partway.
function sampleEven<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

export default function Construction({ logo }: SceneProps) {
  const { dict, format } = useI18n();
  const { viewBox } = logo;
  const s = Math.max(viewBox.w, viewBox.h);
  const hasSkeleton = logo.anchors.length > 0;
  // Draw everything unless the combined node count exceeds the ceiling; then
  // scale both sets down by the same ratio and sample each evenly.
  const totalNodes = logo.anchors.length + logo.handles.length * 2;
  const ratio = totalNodes > MAX_NODES ? MAX_NODES / totalNodes : 1;
  const handles = sampleEven(
    logo.handles,
    Math.floor(logo.handles.length * ratio),
  );
  const anchors = sampleEven(
    logo.anchors,
    Math.floor(logo.anchors.length * ratio),
  );

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <Reveal>
        <SectionIntro
          n="02"
          title={dict.scenes.construction}
          lead={dict.sections.construction.lead}
          slug="construction"
        />
      </Reveal>

      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        {/* Drafting sheet: faint ink grid, generous margin around the mark. */}
        <div
          className="flex items-center border border-hairline px-6 py-28 md:px-16 md:py-44"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, ${GRID_LINE} 0 1px, transparent 1px 48px), repeating-linear-gradient(to bottom, ${GRID_LINE} 0 1px, transparent 1px 48px)`,
          }}
        >
          <div
            className="relative mx-auto w-full max-w-2xl"
            style={{ aspectRatio: `${viewBox.w} / ${viewBox.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(outlineSvg(logo.svg, "#101012"))}
              alt=""
              className="h-full w-full"
            />
            {hasSkeleton && (
              <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                overflow="visible"
              >
                {handles.map((h, i) => (
                  <line
                    key={`l${i}`}
                    x1={h.a.x}
                    y1={h.a.y}
                    x2={h.c.x}
                    y2={h.c.y}
                    stroke={HANDLE_LINE}
                    strokeWidth={s * 0.002}
                  />
                ))}
                {handles.map((h, i) => (
                  <circle
                    key={`c${i}`}
                    cx={h.c.x}
                    cy={h.c.y}
                    r={s * 0.005}
                    fill="#FFFFFF"
                    stroke="#101012"
                    strokeWidth={s * 0.002}
                  />
                ))}
                {/* Anchor points carry the single accent of this spread. */}
                {anchors.map((p, i) => (
                  <circle
                    key={`a${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={s * 0.006}
                    fill="#6C2BFF"
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        {hasSkeleton && (
          <div className="mt-6 flex justify-between border-t border-hairline pt-4 font-mono text-xs uppercase text-ink-muted tabular-nums">
            <p>{format(dict.sections.construction.anchors, { n: logo.anchors.length })}</p>
            <p>{format(dict.sections.construction.handles, { n: logo.handles.length })}</p>
          </div>
        )}
      </Reveal>
    </section>
  );
}
