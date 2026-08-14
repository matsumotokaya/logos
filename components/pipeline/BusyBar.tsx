"use client";

// "Something is happening." A thin bar across the top while a request is out.
//
// Every long step on this page — reading a flyer, writing narration, speaking
// it, rendering an MP4, saving a corrected fact — went out with no visible sign
// beyond a disabled button, and a page that stops responding for twenty seconds
// reads as frozen rather than busy.
//
// Indeterminate on purpose. None of these steps can honestly report a
// percentage: an LLM call takes as long as it takes. What the bar promises is
// only that the request is still in flight, and the label says which one — a
// fake percentage that stalls at 90% is worse than no number at all.
//
// The stage runs additionally get the run card (RunOverlay), which shows what
// each step actually found. This is the floor under everything else.

export default function BusyBar({ label }: { label: string | null }) {
  if (!label) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative h-0.5 w-full overflow-hidden bg-accent/15">
        {/* Transform only, so the film playing behind it keeps its frames. */}
        <span className="progress-indeterminate absolute left-0 top-0 h-full w-2/5 bg-accent" />
      </div>
      <p className="mx-auto mt-2 w-fit rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold text-paper shadow-lg">
        {label}
      </p>
    </div>
  );
}
