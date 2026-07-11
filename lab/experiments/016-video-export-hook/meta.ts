import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "016",
  slug: "video-export-hook",
  title: "動画書き出しフック",
  category: "export",
  tech: ["canvas"],
  impressions: ["基盤", "将来対応"],
  duration: "— (静的: 書き出しインターフェースのプレビュー)",
  supports: ["svg", "png"],
  easing: "—",
  notes:
    "実験ではなく技術検証の枠。実験のアニメをMP4/GIF/WebM動画として書き出す機能の『インターフェースだけ』を用意する(実装は将来)。書き出しの契約は lab/core/export-api.ts に定義: ExportOptions / FrameExporter / createFrameExporter(現状は未実装で明示的にthrow)。UIはフォーマット選択と書き出しボタンの骨組みを表示し、押すと未実装であることを知らせる。将来ここに MediaRecorder(WebM)/gif.js/ffmpeg.wasm 等を差し込めば動く。",
  status: "done",
};
