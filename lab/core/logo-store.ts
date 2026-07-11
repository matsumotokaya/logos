// Logo registry for the lab: bundled dummies + user uploads, one selection
// shared by every experiment on the page. Uploads persist in localStorage as
// raw sources and are re-analyzed on load, so preprocessing improvements
// apply retroactively. Browser only (analysis needs the DOM).

import { newLogoId } from "@/lib/id";
import { DUMMY_LOGOS } from "./dummy-logos";
import { prepareSvgLogo, preparePngLogo } from "./svg-utils";
import type { LabLogo } from "./experiment-api";

const UPLOADS_KEY = "lab.logo-uploads.v1";
const SELECTED_KEY = "lab.logo-selected.v1";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type StoredUpload = {
  id: string;
  name: string;
  kind: "svg" | "png";
  /** SVG source text, or PNG data URI. */
  source: string;
};

export type LogoStoreState = {
  ready: boolean;
  logos: LabLogo[];
  selectedId: string;
};

const INITIAL: LogoStoreState = { ready: false, logos: [], selectedId: "" };

let state: LogoStoreState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeLogoStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLogoStoreState(): LogoStoreState {
  return state;
}

export function getServerLogoStoreState(): LogoStoreState {
  return INITIAL;
}

function readUploads(): StoredUpload[] {
  try {
    const raw = localStorage.getItem(UPLOADS_KEY);
    return raw ? (JSON.parse(raw) as StoredUpload[]) : [];
  } catch {
    return [];
  }
}

function writeUploads(uploads: StoredUpload[]) {
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(uploads));
  } catch {
    // Quota exceeded: selection still works for this session.
  }
}

async function prepareUpload(u: StoredUpload): Promise<LabLogo | null> {
  try {
    return u.kind === "svg"
      ? prepareSvgLogo(u.source, u.name, u.id)
      : await preparePngLogo(u.source, u.name, u.id);
  } catch {
    return null;
  }
}

/** Build built-ins + stored uploads. Safe to call more than once. */
export async function initLogoStore(): Promise<void> {
  if (state.ready) return;

  const builtins = DUMMY_LOGOS.map((d) =>
    prepareSvgLogo(d.svg, d.name, d.id, true),
  );
  const uploads = (
    await Promise.all(readUploads().map(prepareUpload))
  ).filter((l): l is LabLogo => l !== null);

  const logos = [...builtins, ...uploads];
  const stored = localStorage.getItem(SELECTED_KEY);
  const selectedId = logos.some((l) => l.id === stored)
    ? (stored as string)
    : logos[0].id;

  state = { ready: true, logos, selectedId };
  emit();
}

export function selectLogo(id: string) {
  if (!state.logos.some((l) => l.id === id)) return;
  state = { ...state, selectedId: id };
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {}
  emit();
}

/** Register an uploaded file. Returns an error message or null on success. */
export async function addLogoFile(file: File): Promise<string | null> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
  if (!isSvg && !isPng) return "SVGまたはPNGファイルを選択してください。";
  if (file.size > MAX_FILE_BYTES) return "2MB以下のファイルにしてください。";

  const name = file.name.replace(/\.[^.]+$/, "") || "Logo";
  const id = `up-${newLogoId(8)}`;

  let source: string;
  if (isSvg) {
    source = await file.text();
  } else {
    source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  const upload: StoredUpload = { id, name, kind: isSvg ? "svg" : "png", source };
  const logo = await prepareUpload(upload);
  if (!logo) return "このファイルはロゴとして解析できませんでした。";

  writeUploads([...readUploads(), upload]);
  state = { ...state, logos: [...state.logos, logo], selectedId: id };
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {}
  emit();
  return null;
}

export function removeLogo(id: string) {
  const target = state.logos.find((l) => l.id === id);
  if (!target || target.builtin) return;
  writeUploads(readUploads().filter((u) => u.id !== id));
  const logos = state.logos.filter((l) => l.id !== id);
  const selectedId = state.selectedId === id ? logos[0].id : state.selectedId;
  state = { ...state, logos, selectedId };
  emit();
}
