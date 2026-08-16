// Which source files does one composition actually need?
//
// The project export ships the template's own code so the recipient can keep
// working on it. That list must not be written by hand: the moment someone adds
// an import to a scene, a hand-kept list starts shipping a project that does not
// compile, and the failure lands on the recipient rather than on us.
//
// So we walk the imports from the entry file and take the closure. `@/x`
// resolves against the repo root exactly as tsconfig says, and the exported
// project keeps the same alias (pointing at its own `src/`), which is why the
// copied files can be byte-identical to the originals — no rewriting, and a
// recipient can diff their copy against a later version of ours.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * `import x from "y"`, `export { x } from "y"`, and bare `import "y"`.
 *
 * Newlines are allowed between the keyword and the specifier, because a named
 * import list is usually written over several lines. A pattern that stopped at
 * the end of the line silently missed every one of those — the closure came back
 * short by two real files, and the zip it built would have failed to compile in
 * the recipient's hands rather than in ours.
 */
const FROM = /\bfrom\s*["']([^"'\n]+)["']/g;
const SIDE_EFFECT = /(?:^|[\n;])\s*import\s*["']([^"'\n]+)["']/g;

/**
 * Something that could name an npm package.
 *
 * The loose scan above also finds `from "..."` inside a comment or a prompt
 * string. Those never resolve to a file, so the only way they can do damage is
 * by being recorded as a dependency; requiring the shape of a package name is
 * enough to drop them.
 */
const PACKAGE_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:\/[\w.-]+)*$/i;

/** Every module specifier `source` imports, in the order they appear. */
export function importSpecifiers(source: string): string[] {
  return [
    ...[...source.matchAll(FROM)].map((m) => m[1]),
    ...[...source.matchAll(SIDE_EFFECT)].map((m) => m[1]),
  ];
}

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"] as const;

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

/**
 * A specifier as this repo means it: repo-relative path, or null for a package.
 *
 * Unresolvable relative specifiers are an error rather than a skip. Silently
 * dropping one produces a zip that is missing a file nobody notices until the
 * recipient runs it.
 */
async function resolveSpecifier(
  spec: string,
  fromFile: string,
  root: string,
): Promise<string | null> {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(path.join(root, fromFile)), spec);
  else return null;

  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix;
    if (await isFile(candidate)) return path.relative(root, candidate);
  }
  throw new Error(`解決できないimportがあります: "${spec}"（${fromFile}）`);
}

export interface ModuleClosure {
  /** Repo-relative paths, sorted. Includes the entry itself. */
  files: string[];
  /** Bare specifiers the closure imports, sorted. These become dependencies. */
  packages: string[];
}

/** Every source file reachable from `entry`, and the packages it needs. */
export async function moduleClosure(entry: string, root: string): Promise<ModuleClosure> {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = await readFile(path.join(root, file), "utf8");

    for (const spec of importSpecifiers(source)) {
      const resolved = await resolveSpecifier(spec, file, root);
      if (resolved === null) {
        if (!PACKAGE_NAME.test(spec)) continue;
        // "@scope/name/deep" and "name/deep" both belong to one package.
        const parts = spec.split("/");
        packages.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
        continue;
      }
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }

  return {
    files: [...seen].sort(),
    packages: [...packages].sort(),
  };
}
