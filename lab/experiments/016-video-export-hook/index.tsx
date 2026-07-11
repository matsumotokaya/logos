"use client";

// 016 Video Export Hook — a wiring stub, not an effect.
//
// Shows the logo at rest alongside the export UI (format picker + export
// button). The button calls createFrameExporter() from lab/core/export-api,
// which currently throws by design — proving the seam is wired so a real
// encoder (MediaRecorder / gif.js / ffmpeg.wasm) can be dropped in later.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";
import {
  EXPORT_FORMATS,
  createFrameExporter,
  type ExportFormat,
} from "@/lab/core/export-api";

export default function VideoExportHook({ logo }: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    mountLogo(stage, logo);
    return () => {
      stage.innerHTML = "";
    };
  }, [logo]);

  const handleExport = () => {
    try {
      // Wired seam: a future release swaps in a real encoder here.
      createFrameExporter({
        format,
        fps: 30,
        durationMs: 3000,
        width: 1080,
        height: 1080,
      });
      setStatus("書き出しを開始しました"); // unreachable until implemented
    } catch (err) {
      setStatus(
        `未実装(将来対応): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-white p-6">
      <div ref={stageRef} className="h-[38%] w-[38%]" />

      <div className="w-full max-w-md rounded-xl border border-hairline p-4">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          動画書き出し(インターフェースのプレビュー)
        </p>
        <div className="mb-3 flex gap-2">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              title={f.note}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs transition",
                format === f.id
                  ? "border-accent bg-accent text-white"
                  : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="w-full rounded-lg border border-ink bg-ink py-2 text-xs font-medium text-white transition hover:opacity-90"
        >
          {format.toUpperCase()} で書き出す
        </button>
        {status && (
          <p className="mt-3 text-center text-[11px] text-ink-muted">{status}</p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          契約は <code className="font-mono">lab/core/export-api.ts</code> に定義済み(ExportOptions /
          FrameExporter / createFrameExporter)。エンコード実装(MediaRecorder・gif.js・ffmpeg.wasm等)を差し込めば動作する。
        </p>
      </div>
    </div>
  );
}
