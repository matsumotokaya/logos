import { cn } from "@/lib/cn";

// The dot beside 「BGM」 and 「ボイス」 in the video header.
//
// It used to answer only "is this on", which left the most important question
// of the screen unanswered: a user who had just chosen a different track saw a
// green dot and a player still humming the old one. Green read as "done".
//
// So it answers TWO things at once, in the palette the whole screen uses
// (docs/video-state-model.md §3.1):
//
//   green   on, and the film being played has it
//   amber   changed since the film was made — normal, and the thing to know
//   grey    off, and the film being played is silent
//
// Amber, never red: an unreflected change is the ordinary state of a workbench,
// and a red dot sitting there through every edit would teach people to ignore
// the colour that means something is broken.
//
// One component rather than one per dialog, because two dots answering the same
// question in two files is how they end up disagreeing.

export default function StatusDot({
  on,
  /** This field differs from the film the player is running (`pending.changes`). */
  unreflected,
}: {
  on: boolean;
  unreflected: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-1.5 rounded-full",
          unreflected ? "bg-amber-500" : on ? "bg-emerald-500" : "bg-ink/25",
        )}
      />
      {/* Spelt out rather than left to the colour: the state is the point, and a
          colour is not available to everyone reading the screen. */}
      <span className="sr-only">
        {on ? "現在オン" : "現在オフ"}
        {unreflected ? "・この動画にはまだ反映していません" : ""}
      </span>
    </>
  );
}
