// Naming a duplicated take.
//
// Separate from duplicate.ts, which is server-only: the rule for what a copy is
// called is worth testing on its own, and a test cannot import a module that
// refuses to load outside the server.

/** 「秋の展示会」→「秋の展示会のコピー」→「秋の展示会のコピー2」…
 *  Copying a copy keeps one suffix rather than stacking them, so a fifth
 *  version is 「秋の展示会のコピー5」 and not 「…のコピーのコピーのコピー」. */
export function duplicateTitle(sourceTitle: string, existingTitles: string[]): string {
  const trimmed = sourceTitle.trim();
  const root = trimmed.replace(/のコピー\s*\d*$/u, "") || trimmed;
  const taken = new Set(existingTitles.map((title) => title.trim()));
  const first = `${root}のコピー`;
  if (!taken.has(first)) return first;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${root}のコピー${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return first;
}
