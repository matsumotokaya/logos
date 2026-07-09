"use client";

import { useState } from "react";
import { rasterizeSvg } from "@/lib/raster";
import { Caption, type SceneProps } from "./shared";

const SLOTS = [
  { id: "mug", label: "Ceramic mug" },
  { id: "tote", label: "Tote bag" },
  { id: "cap", label: "Cap" },
] as const;

type SlotId = (typeof SLOTS)[number]["id"];
type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; image: string }
  | { status: "error"; message: string };

export default function Generated({ logo, name }: SceneProps) {
  const [slots, setSlots] = useState<Record<SlotId, SlotState>>({
    mug: { status: "idle" },
    tote: { status: "idle" },
    cap: { status: "idle" },
  });

  const setSlot = (id: SlotId, state: SlotState) =>
    setSlots((prev) => ({ ...prev, [id]: state }));

  const generate = async (id: SlotId) => {
    setSlot(id, { status: "loading" });
    try {
      const png = await rasterizeSvg(logo.svg, 1024, "#FFFFFF");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: id,
          imageBase64: png.split(",")[1],
          brandName: name,
          primaryHex: logo.colors[0].hex,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.image) {
        throw new Error(data.error || "Generation failed.");
      }
      setSlot(id, { status: "done", image: data.image });
    } catch (e) {
      setSlot(id, {
        status: "error",
        message: e instanceof Error ? e.message : "Generation failed.",
      });
    }
  };

  return (
    <section className="bg-[#050505] px-6 py-16 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <Caption n="09" title="Generated" />
        <p className="font-mono text-[10px] uppercase text-white/40">
          Photoreal mockups — each slot fills in as it completes
        </p>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {SLOTS.map(({ id, label }) => {
          const state = slots[id];
          return (
            <div key={id}>
              <div
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white/[0.03]"
                aria-busy={state.status === "loading"}
              >
                {state.status === "done" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.image}
                    alt={`Generated mockup: ${name} ${label}`}
                    className="size-full object-cover"
                  />
                ) : state.status === "loading" ? (
                  <div className="absolute inset-0 animate-pulse bg-white/5" />
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-xl p-6 text-center">
                    <button
                      type="button"
                      onClick={() => generate(id)}
                      className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/80 hover:border-white/50 hover:text-white"
                    >
                      {state.status === "error" ? "Retry" : "Generate"}
                    </button>
                    {state.status === "error" && (
                      <p aria-live="polite" className="text-xs text-red-400">
                        {state.message}
                      </p>
                    )}
                  </div>
                )}
                {state.status === "loading" && (
                  <p className="relative font-mono text-xs uppercase text-white/50">
                    Generating…
                  </p>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
