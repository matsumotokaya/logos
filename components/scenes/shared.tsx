import type { LogoData } from "@/lib/svg";

export type Variants = {
  /** Logo repainted in off-white (#F1F3F4), for dark surfaces. */
  white: string;
  /** Logo repainted in near-black (#0A0A0A), for light surfaces. */
  black: string;
};

export type SceneProps = {
  logo: LogoData;
  name: string;
  variants: Variants;
};

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s || "brand";
}

/** Editorial section caption, e.g. "02 — Construction". */
export function Caption({ n, title }: { n: string; title: string }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-white/40">
      {n} — {title}
    </p>
  );
}
