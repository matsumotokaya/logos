// Bundled test logos, one per archetype:
//   - symbol mark (multi-shape, two colors)
//   - wordmark (letterforms as individual paths, monochrome)
//   - combination mark (symbol + wordmark, grouped with a transform)
// Every experiment is judged against all three before being trusted.

export type DummyLogo = { id: string; name: string; svg: string };

// Symbol: two interleaved annular arcs around a center dot ("Halo").
const HALO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <path fill="#101012" d="M94.1 23.4 A100 100 0 0 1 190.7 190.7 L165.3 165.3 A64 64 0 0 0 103.4 58.2 Z"/>
  <path fill="#6C2BFF" d="M145.9 216.6 A100 100 0 0 1 49.3 49.3 L74.7 74.7 A64 64 0 0 0 136.6 181.8 Z"/>
  <path fill="#101012" d="M138 120 A18 18 0 1 1 102 120 A18 18 0 1 1 138 120 Z"/>
</svg>`;

// Wordmark: "MONO", one path per letter so path-level stagger has material.
const MONO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 468 148">
  <path fill="#101012" d="M0 100 L0 0 L26 0 L45 46 L64 0 L90 0 L90 100 L68 100 L68 40 L53 76 L37 76 L22 40 L22 100 Z"/>
  <path fill="#101012" fill-rule="evenodd" d="M110 50 A50 50 0 1 1 210 50 A50 50 0 1 1 110 50 Z M132 50 A28 28 0 1 0 188 50 A28 28 0 1 0 132 50 Z"/>
  <path fill="#101012" d="M230 100 L230 0 L252 0 L278 60 L278 0 L300 0 L300 100 L278 100 L252 40 L252 100 Z"/>
  <path fill="#101012" fill-rule="evenodd" d="M320 50 A50 50 0 1 1 420 50 A50 50 0 1 1 320 50 Z M342 50 A28 28 0 1 0 398 50 A28 28 0 1 0 342 50 Z"/>
</svg>`;

// Combination: kite symbol + "KITE" letterforms.
const KITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 480 160">
  <path fill="#6C2BFF" d="M40 0 L80 52 L40 44 L0 52 Z"/>
  <path fill="#101012" d="M0 52 L40 44 L80 52 L40 112 Z"/>
  <g transform="translate(120 6)">
    <path fill="#101012" d="M0 100 L0 0 L22 0 L22 38 L52 0 L78 0 L40 48 L80 100 L52 100 L22 60 L22 100 Z"/>
    <path fill="#101012" d="M100 0 L122 0 L122 100 L100 100 Z"/>
    <path fill="#101012" d="M142 0 L222 0 L222 22 L193 22 L193 100 L171 100 L171 22 L142 22 Z"/>
    <path fill="#101012" d="M242 0 L312 0 L312 22 L264 22 L264 39 L304 39 L304 61 L264 61 L264 78 L312 78 L312 100 L242 100 Z"/>
  </g>
</svg>`;

export const DUMMY_LOGOS: DummyLogo[] = [
  { id: "builtin-halo", name: "Halo(シンボル型)", svg: HALO },
  { id: "builtin-mono", name: "MONO(ワードマーク型)", svg: MONO },
  { id: "builtin-kite", name: "Kite(複合型)", svg: KITE },
];
