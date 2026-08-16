import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { importSpecifiers, moduleClosure } from "./module-graph";

test("名前付きimportが複数行にまたがっても見落とさない", () => {
  // This is how most of this codebase writes an import list, and a pattern that
  // stopped at the newline missed every one of them. The closure came back two
  // files short, and the zip would have failed to compile for the recipient.
  const source = [
    'import {',
    '  EVENT_CM_GOAL,',
    '} from "@/lib/pipeline/event-cm";',
    'import React from "react";',
    'export { thing } from "./thing";',
    'import "./side-effect";',
  ].join("\n");

  const specs = importSpecifiers(source);
  assert.ok(specs.includes("@/lib/pipeline/event-cm"), "複数行importが拾えていない");
  assert.ok(specs.includes("react"));
  assert.ok(specs.includes("./thing"), "re-exportも依存である");
  assert.ok(specs.includes("./side-effect"));
});

const ROOT = path.resolve(import.meta.dirname, "../..");
const ENTRY = "remotion/event-cm/EventCmComposition.tsx";

test("event-cmの依存を辿ると、テンプレートと必要なlibだけが集まる", async () => {
  const closure = await moduleClosure(ENTRY, ROOT);

  assert.ok(closure.files.includes(ENTRY), "入口そのものが含まれる");
  // The scene vocabulary, the kit it is drawn with, and the one derivation the
  // whole template goes through.
  assert.ok(closure.files.includes("remotion/event-cm/film.ts"));
  assert.ok(closure.files.includes("remotion/kit/theme.ts"));
  assert.ok(closure.files.includes("remotion/kit/layout.ts"));
  // Reached only through a multi-line import in lib/event-cm/facts.ts. Named
  // here because it is the case the walker used to drop.
  assert.ok(
    closure.files.includes("lib/pipeline/event-cm.ts"),
    "複数行import経由の依存が欠けています",
  );
  assert.ok(closure.files.includes("lib/pipeline/stages.ts"));

  // The exported project has no server: anything that imports "server-only"
  // would fail to build in it. This is the guard that keeps someone from
  // reaching into a server module from a scene.
  for (const file of closure.files) {
    assert.ok(
      !file.startsWith("app/"),
      `コンポジションがアプリのコードに依存しています: ${file}`,
    );
  }

  // product-cm belongs to a different template and must not ride along.
  assert.ok(
    !closure.files.some((file) => file.startsWith("remotion/cm/")),
    "event-cmの書き出しに製品CMのコンポジションが混ざっています",
  );
});

test("パッケージは実際に使うものだけを名指しする", async () => {
  const closure = await moduleClosure(ENTRY, ROOT);

  assert.ok(closure.packages.includes("remotion"));
  assert.ok(closure.packages.includes("react"));
  // Scoped packages keep both segments; a bare "@remotion" would not install.
  assert.ok(closure.packages.includes("@remotion/media"));
  // A deep import must not be recorded as its own package.
  assert.ok(
    closure.packages.every((pkg) => pkg.split("/").length <= (pkg.startsWith("@") ? 2 : 1)),
    `パッケージ名にサブパスが混ざっています: ${closure.packages.join(", ")}`,
  );
  assert.ok(
    !closure.packages.includes("server-only"),
    "コンポジションがサーバー専用モジュールに依存しています",
  );
});

test("解決できないimportは、黙って落とさずに止まる", async () => {
  // A zip missing one file is a failure the recipient discovers, not us.
  await assert.rejects(
    () => moduleClosure("lib/export/__does-not-exist.ts", ROOT),
    /ENOENT|解決できないimport/,
  );
});
