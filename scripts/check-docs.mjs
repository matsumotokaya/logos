// Every document must be reachable from README.md, and every link must resolve.
//
//   npm run docs:check
//
// The rule this enforces is in README's "ドキュメント(正本マップ)": an isolated
// document is worse than a missing one, because it is written, findable by
// grep, possibly wrong, and nobody arriving at the entry point will ever be
// told it exists. That happened: ASSET-PROMPTS.md carried the canonical asset
// requirements, was reachable only through a lab README, and a session that
// read the whole 135KB README still wrote a second, weaker copy of it.
//
// Writing the rule down is not enough — the README already forbade turning its
// 現在地 section into a diary and it became one anyway. A rule that is not
// checked is a preference. So this runs.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "var", ".next", "dist"]);
const ENTRY = "README.md";

/** Every markdown file in the repository, entry point included. */
async function allMarkdown(dir = ROOT, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await allMarkdown(path.join(dir, entry.name), found);
    } else if (entry.name.endsWith(".md")) {
      found.push(path.relative(ROOT, path.join(dir, entry.name)));
    }
  }
  return found;
}

// Parentheses are allowed INSIDE a target as long as they balance, because
// Next.js route groups put them in real paths (`app/(management)/...`). A
// regex that stops at the first `)` reports those as broken and sends the
// reader hunting for a file that is fine.
const LINK_OPEN = /\[[^\]]*\]\(/g;

/** Link targets of one document, resolved against its own directory. */
async function linksOf(rel) {
  const body = await readFile(path.join(ROOT, rel), "utf8");
  const out = [];
  for (const match of body.matchAll(LINK_OPEN)) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < body.length && depth > 0; i += 1) {
      if (body[i] === "(") depth += 1;
      else if (body[i] === ")") depth -= 1;
    }
    if (depth !== 0) continue;
    const target = body.slice(match.index + match[0].length, i - 1).split("#")[0].trim();
    // In-page anchors and external URLs are not this tool's business.
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    out.push(path.normalize(path.join(path.dirname(rel), target)));
  }
  return out;
}

// docs/old/ is an archive, and README's rule is that archives are NEVER
// edited. Their links point at code as it was named then, so some of them
// cannot resolve and that is the correct state — an archive that was kept
// current would be a second live document. Reported, never failed on.
const isArchive = (rel) => rel.split(path.sep).includes("old");

const exists = async (rel) => {
  try {
    return await stat(path.join(ROOT, rel));
  } catch {
    return null;
  }
};

/**
 * Walk out from the entry point.
 *
 * A link to a DIRECTORY counts as reaching every document directly inside it —
 * that is how `[docs/old/](docs/old/README.md)`-style pointers and skill
 * directories are meant to read. It does not recurse: a subdirectory needs its
 * own pointer, which is the same rule sub-READMEs already follow.
 */
async function reachable() {
  const seen = new Set([ENTRY]);
  const broken = [];
  const queue = [ENTRY];
  while (queue.length) {
    const current = queue.shift();
    for (const target of await linksOf(current)) {
      const info = await exists(target);
      if (!info) {
        broken.push({ from: current, target });
        continue;
      }
      if (info.isDirectory()) {
        for (const entry of await readdir(path.join(ROOT, target))) {
          const child = path.join(target, entry);
          if (entry.endsWith(".md") && !seen.has(child)) {
            seen.add(child);
            queue.push(child);
          }
        }
        continue;
      }
      if (target.endsWith(".md") && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return { seen, broken };
}

const docs = await allMarkdown();
const { seen, broken } = await reachable();
const orphans = docs.filter((doc) => !seen.has(doc)).sort();

console.log(`ドキュメント ${docs.length}本 / ${ENTRY} から到達 ${seen.size}本`);

const liveBroken = broken.filter(({ from }) => !isArchive(from));
const archiveBroken = broken.filter(({ from }) => isArchive(from));

if (liveBroken.length) {
  console.log(`\n壊れたリンク ${liveBroken.length}件:`);
  for (const { from, target } of liveBroken) console.log(`  ${from} → ${target}`);
}

if (archiveBroken.length) {
  console.log(
    `\n参考 — アーカイブ内の解決できないリンク ${archiveBroken.length}件(直さない。当時の名前を記録しているのが正しい):`,
  );
  for (const { from, target } of archiveBroken) console.log(`  ${from} → ${target}`);
}

if (orphans.length) {
  console.log(`\n孤立した文書 ${orphans.length}件 — ${ENTRY} から辿れません:`);
  for (const doc of orphans) console.log(`  ${doc}`);
  console.log(
    "\n正本マップかサブREADMEにリンクを足すか、消すか、docs/old/ へ移してください。",
  );
}

if (liveBroken.length || orphans.length) process.exit(1);
console.log("\n孤立なし・現役文書のリンク切れなし。");
