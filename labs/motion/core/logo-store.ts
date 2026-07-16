// Logo registry shared by every Lab. User logos come from the same BrandRepo
// canonical entity used by the homepage and Brand Manager; only bundled test
// fixtures remain Lab-local. Browser only (analysis needs the DOM).

import { newLogoId } from "@/lib/id";
import { analyzeSvg } from "@/lib/svg";
import { createStoredLogo, repo, type StoredLogo } from "@/lib/store";
import { DUMMY_LOGOS } from "./dummy-logos";
import { prepareSvgLogo } from "./svg-utils";
import type { LabLogo } from "./experiment-api";

const SELECTED_KEY = "lab.logo-selected.v1";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

function prepareCanonicalLogo(logo: StoredLogo): LabLogo | null {
  try {
    return {
      ...prepareSvgLogo(logo.data.svg, logo.title, logo.id),
      canonical: true,
      candidateId: logo.primaryCandidateId,
    };
  } catch {
    return null;
  }
}

/** Build canonical user logos + bundled test fixtures. Safe to call repeatedly. */
export async function initLogoStore(): Promise<void> {
  if (state.ready) return;

  const builtins = DUMMY_LOGOS.map((d) =>
    prepareSvgLogo(d.svg, d.name, d.id, true),
  );
  let canonical: LabLogo[] = [];
  try {
    canonical = (await repo.listLogos()).flatMap((logo) => {
      const prepared = prepareCanonicalLogo(logo);
      return prepared ? [prepared] : [];
    });
  } catch {
    // Keep bundled fixtures available when auth or persistence is unavailable.
  }

  const logos = [...canonical, ...builtins];
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

/** Register an SVG as a canonical logo entity. Returns an error or null. */
export async function addLogoFile(file: File): Promise<string | null> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (!isSvg) return "正本として登録できるSVGファイルを選択してください。";
  if (file.size > MAX_FILE_BYTES) return "2MB以下のファイルにしてください。";

  const name = file.name.replace(/\.[^.]+$/, "") || "Logo";
  const id = newLogoId();
  let stored: StoredLogo;
  try {
    stored = createStoredLogo({
      id,
      title: name,
      role: "brand",
      data: analyzeSvg(await file.text(), name),
    });
    await repo.saveLogo(stored);
    stored = (await repo.getLogo(id)) ?? stored;
  } catch (error) {
    return error instanceof Error
      ? `ロゴを登録できませんでした: ${error.message}`
      : "ロゴを登録できませんでした。";
  }

  const logo = prepareCanonicalLogo(stored);
  if (!logo) return "登録したSVGをLab用に解析できませんでした。";

  state = { ...state, logos: [logo, ...state.logos], selectedId: id };
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {}
  emit();
  return null;
}
