"use client";

import { useCallback, useEffect, useState } from "react";
import { rasterizeSvg } from "@/lib/raster";
import { repo } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { generationErrorMessage, requestGeneration } from "@/lib/generate-client";
import { useI18n } from "@/lib/i18n";
import type { SceneProps } from "@/components/scenes/shared";

type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; image: string }
  | { status: "error"; message: string };

export default function GeneratedMockupCard({
  scene,
  mockupId,
  label,
  onComposed,
}: {
  scene: SceneProps;
  mockupId: "mug" | "tote" | "cap";
  label: string;
  onComposed?: () => void;
}) {
  const { dict } = useI18n();
  const { isSignedIn } = useAuth();
  const [state, setState] = useState<SlotState>({ status: "loading" });

  const generate = useCallback(async () => {
    // Generation is a paid call gated to registered users server-side;
    // short-circuit here so guests get the message without an API call.
    if (!isSignedIn) {
      setState({ status: "error", message: dict.gen.signInRequired });
      return;
    }
    setState({ status: "loading" });
    try {
      const png = await rasterizeSvg(scene.logo.svg, 1024, "#FFFFFF");
      const image = await requestGeneration({
        target: mockupId,
        imageBase64: png.split(",")[1],
        brandName: scene.name,
        primaryHex: scene.logo.colors[0].hex,
      });
      setState({ status: "done", image });
      await repo.saveMockup(
        scene.mockupLogoId ?? "",
        scene.mockupCandidateId,
        mockupId,
        image,
      );
      onComposed?.();
    } catch (e) {
      setState({
        status: "error",
        message: generationErrorMessage(e, dict.gen),
      });
    }
  }, [
    dict.gen,
    isSignedIn,
    mockupId,
    onComposed,
    scene.logo.colors,
    scene.logo.svg,
    scene.mockupCandidateId,
    scene.mockupLogoId,
    scene.name,
  ]);

  useEffect(() => {
    let alive = true;
    if (!scene.mockupLogoId) {
      Promise.resolve().then(() => {
        if (alive) setState({ status: "idle" });
      });
      return () => {
        alive = false;
      };
    }
    repo.getMockups(scene.mockupLogoId, scene.mockupCandidateId).then((cached) => {
      if (!alive) return;
      setState(
        cached[mockupId]
          ? { status: "done", image: cached[mockupId] }
          : { status: "idle" },
      );
    });
    return () => {
      alive = false;
    };
  }, [mockupId, scene.mockupCandidateId, scene.mockupLogoId]);

  return (
    <div>
      <div
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-hairline bg-[#F7F7F6]"
        aria-busy={state.status === "loading"}
      >
        {state.status === "done" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.image}
            alt={`Generated mockup: ${scene.name} ${label}`}
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
              onClick={() => void generate()}
              className="border border-hairline px-4 py-1.5 font-mono text-[11px] uppercase text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              {state.status === "error" ? dict.gen.retry : dict.gen.action}
            </button>
            <p aria-live="polite" className="text-xs text-red-600">
              {state.status === "error" ? state.message : ""}
            </p>
          </div>
        )}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase text-ink-muted">{label}</p>
    </div>
  );
}
