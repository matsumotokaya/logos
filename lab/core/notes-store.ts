// Research notes per experiment: star rating (0-5) + free text.
// This is the lab's decision log for adopt/drop judgements. localStorage only.

const KEY = "lab.notes.v1";

export type ExperimentNote = {
  rating: number; // 0 = unrated, 1-5 stars
  note: string;
};

type NotesMap = Record<string, ExperimentNote>;

let cache: NotesMap | null = null;
const listeners = new Set<() => void>();

function load(): NotesMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as NotesMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function subscribeNotes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNotesSnapshot(): NotesMap {
  return typeof window === "undefined" ? {} : load();
}

const EMPTY: NotesMap = {};
export function getServerNotesSnapshot(): NotesMap {
  return EMPTY;
}

export function getNote(experimentId: string): ExperimentNote {
  return getNotesSnapshot()[experimentId] ?? { rating: 0, note: "" };
}

export function setNote(experimentId: string, next: ExperimentNote) {
  const map = { ...load(), [experimentId]: next };
  if (!next.rating && !next.note.trim()) delete map[experimentId];
  cache = map;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
  listeners.forEach((fn) => fn());
}
