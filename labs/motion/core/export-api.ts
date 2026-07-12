// Video export interface — a stub for a future release (experiment 016).
//
// The goal is to record an experiment's animation into a downloadable video
// (MP4 / GIF / WebM) for social, ads, email, etc. Encoding is intentionally
// NOT implemented yet; this file fixes the contract so the UI and call sites
// can be wired now and the real encoder dropped in later without churn.
//
// Likely future implementations: canvas.captureStream + MediaRecorder (WebM),
// gif.js (GIF), or ffmpeg.wasm (MP4) — chosen per format/quality tradeoffs.

export type ExportFormat = "mp4" | "gif" | "webm";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; note: string }[] =
  [
    { id: "mp4", label: "MP4", note: "SNS・広告向け(H.264)" },
    { id: "gif", label: "GIF", note: "メール・軽量埋め込み" },
    { id: "webm", label: "WebM", note: "Web埋め込み(透過可)" },
  ];

export type ExportOptions = {
  format: ExportFormat;
  fps: number;
  durationMs: number;
  width: number;
  height: number;
  /** Transparent background where the format supports it (webm/gif). */
  transparent?: boolean;
};

export type ExportPhase =
  | "idle"
  | "recording"
  | "encoding"
  | "done"
  | "error";

export type ExportProgress = {
  phase: ExportPhase;
  /** 0..1 within the current phase. */
  progress: number;
  message?: string;
};

/**
 * Records frames and produces a video Blob. A future encoder will implement
 * this; call sites program against the interface today.
 */
export interface FrameExporter {
  /** Begin a recording session. */
  begin(): void;
  /** Submit one rendered frame (typically the experiment's canvas). */
  capture(source: HTMLCanvasElement | HTMLElement): void;
  /** Finish and resolve the encoded file. */
  end(onProgress?: (p: ExportProgress) => void): Promise<Blob>;
  /** Abort and release resources. */
  cancel(): void;
}

export const VIDEO_EXPORT_IMPLEMENTED = false as const;

/**
 * Factory for a FrameExporter. Not implemented yet — throws so callers fail
 * loudly rather than silently producing nothing. Swap the body in later.
 */
export function createFrameExporter(options: ExportOptions): FrameExporter {
  throw new Error(
    `Video export (${options.format}) is not implemented yet — interface stub for a future release.`,
  );
}
