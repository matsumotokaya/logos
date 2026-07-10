"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rasterizeSvg } from "@/lib/raster";
import { repo } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, type SceneProps } from "./shared";

const SLOT_IDS = ["mug", "tote", "cap"] as const;

type SlotId = (typeof SLOT_IDS)[number];
type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; image: string }
  | { status: "error"; message: string };

/** Stable per-logo cache key (FNV-1a over the baked master SVG). */
function logoKeyOf(svg: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < svg.length; i++) {
    h ^= svg.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const IDLE_SLOTS: Record<SlotId, SlotState> = {
  mug: { status: "idle" },
  tote: { status: "idle" },
  cap: { status: "idle" },
};

export default function Generated({ logo, name }: SceneProps) {
  const { dict } = useI18n();
  const key = useMemo(() => logoKeyOf(logo.svg), [logo.svg]);

  const [slots, setSlots] = useState<Record<SlotId, SlotState>>(IDLE_SLOTS);
  const [hydrated, setHydrated] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  // Mirror of `slots` readable from the IntersectionObserver callback.
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  // Ensures the one-time auto-generation fires only once per logo.
  const autoStartedRef = useRef(false);

  const setSlot = useCallback(
    (id: SlotId, state: SlotState) =>
      setSlots((prev) => ({ ...prev, [id]: state })),
    []
  );

  const generate = useCallback(
    async (id: SlotId) => {
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
          throw new Error(data.error || dict.gen.failed);
        }
        setSlot(id, { status: "done", image: data.image });
        // Persist so this paid generation is never repeated for this logo.
        void repo.saveMockup(key, id, data.image);
      } catch (e) {
        setSlot(id, {
          status: "error",
          message: e instanceof Error ? e.message : dict.gen.failed,
        });
      }
    },
    [logo.svg, logo.colors, name, key, dict.gen.failed, setSlot]
  );

  // Load any cached mockups for this logo; uncached slots stay idle. State is
  // set from the async callback (never synchronously) so switching logos does
  // not flash stale tiles before the cache resolves.
  useEffect(() => {
    let alive = true;
    autoStartedRef.current = false;
    repo.getMockups(key).then((cached) => {
      if (!alive) return;
      setSlots({
        mug: cached.mug ? { status: "done", image: cached.mug } : { status: "idle" },
        tote: cached.tote ? { status: "done", image: cached.tote } : { status: "idle" },
        cap: cached.cap ? { status: "done", image: cached.cap } : { status: "idle" },
      });
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  // First time the section is scrolled into view, auto-generate whatever is
  // not already cached — once. This defers the paid API calls until the user
  // actually reaches the section, and never repeats what's persisted.
  useEffect(() => {
    if (!hydrated) return;
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || autoStartedRef.current) return;
        autoStartedRef.current = true;
        for (const id of SLOT_IDS) {
          if (slotsRef.current[id].status === "idle") void generate(id);
        }
      },
      { threshold: 0.2 }
    );
    io.observe(section);
    return () => io.disconnect();
  }, [hydrated, generate]);

  return (
    <section
      ref={sectionRef}
      className="flex min-h-dvh flex-col justify-center bg-paper"
    >
      <SectionIntro
        n="10"
        title={dict.scenes.generated}
        lead={dict.sections.generated.lead}
      />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="grid gap-x-4 gap-y-8 md:grid-cols-3">
          {SLOT_IDS.map((id) => {
            const state = hydrated ? slots[id] : ({ status: "loading" } as const);
            const label = dict.sections.generated[id];
            return (
              <div key={id}>
                <div
                  className="relative flex aspect-square items-center justify-center overflow-hidden border border-hairline bg-[#F7F7F6]"
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
                    <>
                      <div className="absolute inset-0 animate-pulse bg-ink/5" />
                      <p className="relative font-mono text-[11px] uppercase text-ink-muted">
                        {dict.gen.generating}
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <button
                        type="button"
                        onClick={() => generate(id)}
                        className="border border-hairline px-4 py-1.5 font-mono text-[11px] uppercase text-ink-muted transition-colors hover:border-ink hover:text-ink"
                      >
                        {state.status === "error"
                          ? dict.gen.retry
                          : dict.gen.action}
                      </button>
                      <p aria-live="polite" className="text-xs text-red-600">
                        {state.status === "error" ? state.message : ""}
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase text-ink-muted">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
