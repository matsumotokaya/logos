"use client";

import { useEffect, useRef, useState } from "react";
import { composePayloadToUrl } from "@/labs/workflow/core/client";
import type { ComposeMetrics } from "@/labs/workflow/core/pipeline";
import type { SceneProps } from "@/components/scenes/shared";
import { cn } from "@/lib/cn";

export default function WorkflowTemplateArt({
  templateId,
  scene,
  className,
  width = 1200,
  showMetrics = false,
  onComposed,
}: {
  templateId: string;
  scene: SceneProps;
  className?: string;
  width?: number;
  showMetrics?: boolean;
  onComposed?: (metrics: ComposeMetrics) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ComposeMetrics | null>(null);
  const urlRef = useRef<string | null>(null);
  const hasSvg = Boolean(scene.logo.svg);

  useEffect(() => {
    if (!hasSvg) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      composePayloadToUrl(
        templateId,
        { kind: "svg", svg: scene.logo.svg },
        { width },
        controller.signal,
      )
        .then((result) => {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = result.url;
          setUrl(result.url);
          setMetrics(result.metrics);
          setBusy(false);
          onComposed?.(result.metrics);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : "合成に失敗");
          setBusy(false);
        });
    }, 80);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasSvg, templateId, scene.logo.svg, width, onComposed]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return (
    <div className={cn("relative", className)}>
      {!hasSvg ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-red-200 bg-white p-4">
          <p className="text-sm text-red-600">このロゴはテンプレート合成に使えない</p>
        </div>
      ) : error ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-red-200 bg-white p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className={cn(
              "w-full rounded-xl border border-hairline bg-paper object-cover transition-opacity",
              busy && "opacity-50",
            )}
          />
          {showMetrics && metrics ? (
            <span className="absolute right-3 bottom-3 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-[10px] text-white">
              {metrics.totalMs}ms
            </span>
          ) : null}
        </>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-hairline bg-paper">
          <p className="text-sm text-ink-muted">{busy ? "合成中…" : "読み込み中…"}</p>
        </div>
      )}
    </div>
  );
}
