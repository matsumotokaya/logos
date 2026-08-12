"use client";

// The video's input stage: what this film is briefed from.
//
// A pasted paragraph and an uploaded flyer are the same thing once stored, so
// both live in one list. Running the stages is manual and one at a time — the
// point of showing a pipeline is that a person can run a step, look at what it
// did, and decide about the next one.

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface BriefSource {
  id: string;
  kind: string;
  label: string;
  media_type: string | null;
  bytes: number | null;
}

const KIND_LABEL: Record<string, string> = {
  document: "資料",
  photo: "画像",
  logo: "ロゴ",
  audio: "音声",
  other: "その他",
};

const readableSize = (bytes: number | null): string =>
  bytes === null ? "" : bytes < 1024 ? `${bytes}B` : `${Math.round(bytes / 1024)}KB`;

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
    reader.readAsDataURL(file);
  });

export default function BriefSourceIntake({
  sources,
  busy,
  onUpload,
  onAddText,
  onRemove,
}: {
  sources: BriefSource[];
  busy: boolean;
  onUpload: (file: File, data: string) => Promise<void>;
  onAddText: (text: string) => Promise<void>;
  onRemove: (materialId: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);

  const accept = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      await onUpload(file, await toBase64(file));
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight">
          この動画のもとになっている資料
        </h2>
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
      </div>

      <ul className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
          >
            <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-muted">
              {KIND_LABEL[source.kind] ?? source.kind}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{source.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-ink-faint">
              {readableSize(source.bytes)}
            </span>
            <button
              type="button"
              onClick={() => void onRemove(source.id)}
              disabled={busy}
              className="shrink-0 text-xs text-ink-faint underline underline-offset-2 hover:text-red-700 disabled:opacity-50"
            >
              外す
            </button>
          </li>
        ))}
        {sources.length === 0 ? (
          <li className="rounded-lg border border-dashed border-hairline px-3 py-3 text-[12px] text-ink-muted">
            まだ資料がありません。いまの動画の内容は、すべてこちらで仮に決めたものです。
          </li>
        ) : null}
      </ul>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed px-4 py-6 text-center transition",
          dragging ? "border-ink bg-ink/[0.03]" : "border-hairline",
        )}
      >
        <p className="text-[12px] text-ink-muted">
          フライヤー・企画書・写真をここにドロップ
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void accept(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-3 rounded-full border border-hairline px-4 py-1.5 text-xs font-semibold hover:border-ink disabled:opacity-50"
        >
          ファイルを選ぶ
        </button>
      </div>

      <div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Slackの雑文でも、企画のメモでも。そのまま貼ってください"
          className="w-full rounded-xl border border-hairline px-3 py-2.5 text-[13px] outline-none focus:border-ink"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              if (!note.trim()) return;
              await onAddText(note);
              setNote("");
            }}
            disabled={busy || !note.trim()}
            className="rounded-full border border-hairline px-4 py-1.5 text-xs font-semibold hover:border-ink disabled:opacity-50"
          >
            テキストとして追加
          </button>
        </div>
      </div>

    </section>
  );
}
