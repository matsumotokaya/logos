import { svgToDataUri, outlineSvg } from "@/lib/svg";
import { Caption, type SceneProps } from "./shared";

const MAX_MARKS = 800;

export default function Construction({ logo }: SceneProps) {
  const { viewBox } = logo;
  const s = Math.max(viewBox.w, viewBox.h);
  const hasSkeleton = logo.anchors.length > 0;
  const handles = logo.handles.slice(0, MAX_MARKS);
  const anchors = logo.anchors.slice(0, MAX_MARKS);

  return (
    <section className="flex min-h-dvh flex-col bg-black px-6 py-16 md:px-12">
      <Caption n="01" title="Construction" />

      <div
        className="flex flex-1 items-center py-16"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0 1px, transparent 1px 40px), repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0 1px, transparent 1px 40px)",
        }}
      >
        <div
          className="relative mx-auto w-full max-w-3xl"
          style={{ aspectRatio: `${viewBox.w} / ${viewBox.h}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgToDataUri(outlineSvg(logo.svg, "#F1F3F4"))}
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
                  stroke="#F1F3F4"
                  strokeOpacity={0.4}
                  strokeWidth={s * 0.002}
                />
              ))}
              {handles.map((h, i) => (
                <circle
                  key={`c${i}`}
                  cx={h.c.x}
                  cy={h.c.y}
                  r={s * 0.005}
                  fill="#000"
                  stroke="#F1F3F4"
                  strokeWidth={s * 0.002}
                />
              ))}
              {anchors.map((p, i) => (
                <circle key={`a${i}`} cx={p.x} cy={p.y} r={s * 0.008} fill="#F1F3F4" />
              ))}
            </svg>
          )}
        </div>
      </div>

      {hasSkeleton && (
        <div className="flex justify-between font-mono text-xs uppercase tabular-nums text-white/40">
          <p>{logo.anchors.length} anchor points</p>
          <p>{logo.handles.length} control handles</p>
        </div>
      )}
    </section>
  );
}
