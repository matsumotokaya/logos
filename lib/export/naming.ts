// What the export is called, on disk and to npm.
//
// Two names, because two systems disagree about what a name may contain: the
// zip's own directory table and npm both insist on ASCII, while the person
// downloading it should see the event's actual title.

/**
 * The folder inside the zip, and the package name.
 *
 * ASCII on purpose, even though these events are named in Japanese. Two things
 * insist on it: the zip's own filename table is written as raw bytes without the
 * UTF-8 flag, so a Japanese directory reaches `unzip` as mojibake it refuses to
 * create; and npm rejects a `name` that is not lowercase ASCII. The readable
 * title is not lost — it names the downloaded file (see `projectFilename`) and
 * heads the README.
 */
export function projectSlug(title: string, takeId: string): string {
  const cleaned = title
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]+/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  // A title that is entirely Japanese leaves nothing behind, and a one-letter
  // folder says less than the id does.
  return cleaned.length >= 3 ? cleaned : `event-cm-${takeId.slice(0, 8)}`;
}

/**
 * The name the browser saves the download as.
 *
 * Keeps the title as written, minus the characters no filesystem accepts. This
 * is the one place the reader sees the event's own name, so it is worth the
 * separate rule.
 */
export function projectFilename(title: string, takeId: string): string {
  const safe = title
    .replace(/[\x00-\x1f/\\:*?"<>|]+/g, "")
    .trim()
    .slice(0, 60);
  return `${safe.length > 0 ? safe : projectSlug(title, takeId)}.zip`;
}
