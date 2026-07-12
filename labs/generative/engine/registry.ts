// Expression-template discovery — server only. Same feedback loop as the
// Workflow Lab: labs/generative/templates/ is scanned at request time,
// broken templates stay visible in the catalog with their errors.
// Adding an art direction = dropping in a directory with template.json.

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import {
  validateExpressionTemplate,
  type ExpressionTemplate,
} from "@/labs/generative/core/expression-format";
import type { ExpressionCatalogEntry } from "@/labs/generative/core/api-types";

const TEMPLATES_DIR = path.join(process.cwd(), "labs", "generative", "templates");

async function loadEntry(id: string): Promise<ExpressionCatalogEntry> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(path.join(TEMPLATES_DIR, id, "template.json"), "utf8"),
    );
  } catch (e) {
    return {
      id,
      errors: [`template.json を読めない: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  const result = validateExpressionTemplate(parsed, id);
  return result.ok
    ? { id, template: result.template, errors: [] }
    : { id, errors: result.errors };
}

export async function listExpressionTemplates(): Promise<ExpressionCatalogEntry[]> {
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

export async function loadExpressionTemplate(
  id: string,
): Promise<ExpressionTemplate> {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`不正なテンプレートID: ${id}`);
  const entry = await loadEntry(id);
  if (!entry.template || entry.errors.length > 0)
    throw new Error(`テンプレート "${id}" が無効: ${entry.errors.join(" / ") || "不明"}`);
  return entry.template;
}
