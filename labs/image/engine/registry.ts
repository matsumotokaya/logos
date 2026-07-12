// Template discovery — server only.
//
// Templates are data, not code: the server scans labs/image/templates/ at
// request time, validates every template.json against the format spec and
// checks that referenced assets exist. Broken templates stay visible in the
// catalog with their errors — a designer dropping in a new directory gets
// feedback in the lab UI, never a silent omission.

import path from "node:path";
import { access, readdir, readFile } from "node:fs/promises";
import {
  templateAssetPaths,
  validateTemplate,
  type Template2D,
} from "@/labs/image/core/template-format";

const TEMPLATES_DIR = path.join(process.cwd(), "labs", "image", "templates");

export type CatalogEntry = {
  /** Directory name (canonical id, even when template.json is broken). */
  id: string;
  template?: Template2D;
  errors: string[];
};

async function loadEntry(id: string): Promise<CatalogEntry> {
  const dir = path.join(TEMPLATES_DIR, id);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.join(dir, "template.json"), "utf8"));
  } catch (e) {
    return { id, errors: [`template.json を読めない: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const result = validateTemplate(parsed, id);
  if (!result.ok) return { id, errors: result.errors };

  const missing: string[] = [];
  for (const rel of templateAssetPaths(result.template)) {
    try {
      await access(path.join(dir, rel));
    } catch {
      missing.push(`アセットが見つからない: ${rel}`);
    }
  }
  return { id, template: result.template, errors: missing };
}

/** Scan, validate and sort the whole catalog. */
export async function listTemplates(): Promise<CatalogEntry[]> {
  let dirs: string[];
  try {
    dirs = (await readdir(TEMPLATES_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
  return Promise.all(dirs.map(loadEntry));
}

/** Load one valid template or throw with the validation errors. */
export async function loadTemplate(
  id: string,
): Promise<{ template: Template2D; dir: string }> {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`不正なテンプレートID: ${id}`);
  const entry = await loadEntry(id);
  if (!entry.template || entry.errors.length > 0) {
    throw new Error(`テンプレート "${id}" が無効: ${entry.errors.join(" / ") || "不明"}`);
  }
  return { template: entry.template, dir: path.join(TEMPLATES_DIR, id) };
}
