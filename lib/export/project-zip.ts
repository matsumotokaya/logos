import "server-only";

// The project file export: this video, as a Remotion project someone can open.
//
// The point is that a video made here is not locked in. A user who wants to keep
// tuning past what this tool offers should be able to take the thing away and
// carry on in Remotion — which means shipping the template's source, not a
// rendered file and not a proprietary bundle.
//
// Three things are deliberately NOT in the zip:
//
//   - Remotion itself. It is not ours to redistribute, so it is written as a
//     dependency and the recipient installs it under their own licence.
//   - Default assets we cannot pass on (`licensed: false`). This is the first
//     caller `unlicensedDefaults()` has ever had; until now the flag only
//     changed what the picker said.
//   - Anything not reachable from the composition. The file list is the import
//     closure (module-graph.ts), so it is right by construction.
//
// The copied sources keep their `@/` imports and their repo-relative paths under
// `src/`, with the alias re-pointed in the exported tsconfig and webpack config.
// That means a file in the zip is byte-identical to ours, and the recipient can
// diff against a later version instead of reverse-engineering a rewrite.

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync, type Zippable } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageBriefMaterials } from "@/lib/takes/materials";
import { unlicensedDefaults } from "@/lib/assets/defaults";
import { themeById } from "@/remotion/kit/theme";
import { moduleClosure } from "./module-graph";
import { projectFilename, projectSlug } from "./naming";
import { projectReadme } from "./readme";

/** The composition the export is built around. */
const ENTRY = "remotion/event-cm/EventCmComposition.tsx";
const COMPOSITION_ID = "event-cm";

/** Package versions come from ours, so the recipient installs what we tested. */
const RUNTIME_PACKAGES = ["remotion", "@remotion/media", "react", "react-dom", "zod"] as const;
const DEV_PACKAGES = ["@remotion/cli", "typescript", "@types/react"] as const;

export interface ProjectExport {
  zip: Uint8Array;
  /** Suggested download name, already safe for a Content-Disposition header. */
  filename: string;
  /** Default assets left out because we cannot pass them on. */
  excluded: string[];
}

/** A directory tree, flattened to posix paths relative to `dir`. */
async function readTree(dir: string, prefix = ""): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of await readTree(full, rel)) out.set(k, v);
    } else {
      out.set(rel, new Uint8Array(await readFile(full)));
    }
  }
  return out;
}

/** package.json for the exported project, pinned to the versions we render with. */
function packageJson(name: string, ourDeps: Record<string, string>): string {
  const pick = (names: readonly string[]) =>
    Object.fromEntries(
      names
        .filter((pkg) => ourDeps[pkg])
        .map((pkg) => [pkg, ourDeps[pkg]] as const),
    );
  return `${JSON.stringify(
    {
      name,
      private: true,
      version: "1.0.0",
      scripts: {
        studio: "remotion studio src/index.ts",
        render: `remotion render src/index.ts ${COMPOSITION_ID} out/video.mp4 --props=props.json`,
      },
      dependencies: pick(RUNTIME_PACKAGES),
      devDependencies: pick(DEV_PACKAGES),
    },
    null,
    2,
  )}\n`;
}

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      jsx: "react-jsx",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      esModuleInterop: true,
      // The copied sources are unmodified, so the alias has to mean here what it
      // means in the project they came from.
      paths: { "@/*": ["./src/*"] },
    },
    include: ["src", "remotion.config.ts"],
  },
  null,
  2,
)}\n`;

// The Remotion CLI's webpack does not read tsconfig paths, so the alias is
// declared again here. Without it every `@/...` import in the copied sources
// fails to resolve and nothing renders.
const REMOTION_CONFIG = `import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@": path.join(process.cwd(), "src"),
    },
  },
}));
`;

const INDEX_TS = `import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
`;

/**
 * The composition registration.
 *
 * Duration is computed from the brief rather than fixed, the same way the app's
 * player does it: the narration decides how long the film is, so a longer line
 * has to make a longer video here too.
 */
const ROOT_TSX = `import React from "react";
import { Composition } from "remotion";
import {
  EventCmComposition,
  eventCmDurationInFrames,
  EVENT_FPS,
  EVENT_WIDTH,
  EVENT_HEIGHT,
} from "@/remotion/event-cm/EventCmComposition";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import briefJson from "../props.json";

const brief = briefJson as unknown as EventCmBrief;

export const Root: React.FC = () => (
  <Composition
    id="${COMPOSITION_ID}"
    component={EventCmComposition}
    fps={EVENT_FPS}
    width={EVENT_WIDTH}
    height={EVENT_HEIGHT}
    durationInFrames={eventCmDurationInFrames(brief)}
    defaultProps={{ brief }}
    calculateMetadata={({ props }) => ({
      durationInFrames: eventCmDurationInFrames(props.brief),
      props,
    })}
  />
);
`;

/**
 * Build the zip for one take.
 *
 * `brief` is the baked one where there is one: the export should be the video
 * the user is looking at, not the edits they have not applied yet.
 */
export async function buildProjectZip(
  supabase: SupabaseClient,
  input: {
    takeId: string;
    title: string;
    brief: unknown;
    bakedAt: string | null;
  },
  options: { root?: string } = {},
): Promise<ProjectExport> {
  const root = options.root ?? process.cwd();
  const slug = projectSlug(input.title, input.takeId);

  const dir = await mkdtemp(path.join(tmpdir(), "logos-project-"));
  try {
    const publicDir = path.join(dir, "public");
    const staged = (await stageBriefMaterials(
      supabase,
      input.takeId,
      input.brief,
      publicDir,
    )) as Record<string, unknown>;

    // Default assets are paths under our own public/, not pinned materials, so
    // staging does not touch them. Carry the ones we may pass on, and take the
    // others out of the brief — leaving the path in would point the recipient's
    // project at a file that is not there.
    const files: Zippable = {};
    const excluded: string[] = [];
    // Staged materials now land under `assets/` (lib/materials/naming.ts); a
    // path outside it is one of our own bundled defaults, which staging never
    // touches.
    const bgm = typeof staged.bgm === "string" ? staged.bgm : null;
    if (bgm && !bgm.startsWith("assets/")) {
      const unlicensed = unlicensedDefaults([bgm]);
      if (unlicensed.length > 0) {
        excluded.push(...unlicensed.map((asset) => asset.label));
        delete staged.bgm;
      } else {
        const bytes = await readFile(path.join(root, "public", bgm)).catch(() => null);
        if (bytes) files[`${slug}/public/${bgm}`] = new Uint8Array(bytes);
        else delete staged.bgm;
      }
    }

    // The ART DIRECTION's own assets, which no brief field names.
    //
    // `theme.endCard.video` is the footage the closing plate stands on, declared
    // by the theme rather than by the brief — so the bgm branch above cannot see
    // it and the recipient would get a project whose theme points at a file the
    // zip never carried. It is not a broken zip either way (defaults.ts travels
    // with its `licensed` flag, so the copied composition applies the same
    // exclusion), but the dialog's job is to NAME what is being left out, and an
    // exclusion nobody mentions is the kind of surprise this export exists to
    // avoid.
    const endCardVideo = themeById(
      typeof (input.brief as { artDirection?: unknown }).artDirection === "string"
        ? ((input.brief as { artDirection: string }).artDirection)
        : undefined,
    ).endCard?.video;
    if (endCardVideo) {
      const unlicensed = unlicensedDefaults([endCardVideo]);
      if (unlicensed.length > 0) {
        excluded.push(...unlicensed.map((asset) => asset.label));
      } else {
        const bytes = await readFile(path.join(root, "public", endCardVideo)).catch(
          () => null,
        );
        if (bytes) files[`${slug}/public/${endCardVideo}`] = new Uint8Array(bytes);
      }
    }

    for (const [rel, bytes] of await readTree(publicDir)) {
      files[`${slug}/public/${rel}`] = bytes;
    }

    const closure = await moduleClosure(ENTRY, root);
    for (const file of closure.files) {
      files[`${slug}/src/${file}`] = new Uint8Array(await readFile(path.join(root, file)));
    }

    const ourPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const ourDeps = { ...ourPackage.dependencies, ...ourPackage.devDependencies };

    const text = (value: string) => new TextEncoder().encode(value);
    files[`${slug}/props.json`] = text(`${JSON.stringify(staged, null, 2)}\n`);
    files[`${slug}/package.json`] = text(packageJson(slug, ourDeps));
    files[`${slug}/tsconfig.json`] = text(TSCONFIG);
    files[`${slug}/remotion.config.ts`] = text(REMOTION_CONFIG);
    files[`${slug}/src/index.ts`] = text(INDEX_TS);
    files[`${slug}/src/Root.tsx`] = text(ROOT_TSX);
    files[`${slug}/README.md`] = text(
      projectReadme({
        title: input.title,
        compositionId: COMPOSITION_ID,
        bakedAt: input.bakedAt,
        excluded,
        sourceFiles: closure.files,
      }),
    );

    return {
      zip: zipSync(files, { level: 6 }),
      filename: projectFilename(input.title, input.takeId),
      excluded,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
