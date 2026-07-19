"use client";

import { useEffect, useMemo, useState } from "react";
import { recolorSvg, type LogoData } from "@/lib/svg";
import { SERVICE_NAME } from "@/lib/config";
import { emptyPresentation, type LogoPresentation } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import {
  fetchPresentationCatalog,
  type PresentationCatalogResponse,
} from "@/lib/presentation-catalog";
import { resolvePresentationAssets } from "@/lib/presentation-schema";
import AppHeader from "@/components/AppHeader";
import PresentationLayoutEditor from "@/components/presentation/PresentationLayoutEditor";
import MockupScene from "@/components/scenes/MockupScene";
import {
  PresentationEditProvider,
  type PresentationPatch,
  type Variants,
} from "@/components/scenes/shared";
import Splash from "@/components/scenes/Splash";
import Contents from "@/components/scenes/Contents";
import Identity from "@/components/scenes/Identity";
import Construction from "@/components/scenes/Construction";
import Palette from "@/components/scenes/Palette";
import UsageGrid from "@/components/scenes/UsageGrid";
import AppIcons from "@/components/scenes/AppIcons";
import Browser from "@/components/scenes/Browser";

type Props = {
  logo: LogoData;
  name: string;
  mockupLogoId?: string;
  mockupCandidateId?: string;
  onReset: () => void;
  /** Creator contact address; renders a mailto link in the footer when set. */
  contactEmail?: string | null;
  /** Editorial copy + per-logo presentation layout overrides. */
  presentation?: LogoPresentation | null;
  /** The current viewer owns the logo / has edit rights. */
  canEdit?: boolean;
  /** A real account is required to enter edit mode. */
  isSignedIn?: boolean;
  /** Opens the auth dialog when editing requires sign-in. */
  onRequestSignIn?: () => void;
  /** Persist all staged edits in one save action. */
  onCommitEdits?: (payload: {
    name: string;
    presentation: LogoPresentation;
  }) => void | Promise<void>;
};

function applyPresentationPatch(
  base: LogoPresentation,
  patch: PresentationPatch,
): LogoPresentation {
  if ("layout" in patch) {
    return { ...base, layout: patch.layout };
  }
  if ("sceneLead" in patch) {
    const { slug, lead } = patch.sceneLead;
    const sceneTexts = { ...base.sceneTexts };
    if (lead) sceneTexts[slug] = { ...sceneTexts[slug], lead };
    else delete sceneTexts[slug];
    return { ...base, sceneTexts };
  }
  return { ...base, ...patch };
}

export default function Presentation({
  logo,
  name,
  mockupLogoId,
  mockupCandidateId,
  onReset,
  contactEmail,
  presentation,
  canEdit = false,
  isSignedIn = false,
  onRequestSignIn,
  onCommitEdits,
}: Props) {
  const { dict, format } = useI18n();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftPresentation, setDraftPresentation] = useState<LogoPresentation>(
    presentation ?? emptyPresentation(),
  );
  const [assetCatalog, setAssetCatalog] = useState<PresentationCatalogResponse | null>(null);
  const variants = useMemo<Variants>(
    () => ({
      white: recolorSvg(logo.svg, "#F4F4F2"),
      black: recolorSvg(logo.svg, "#101012"),
    }),
    [logo.svg]
  );

  const sourcePresentation = presentation ?? emptyPresentation();
  const editable = canEdit;
  const activeName = editing ? draftName : name;
  const activePresentation = editing ? draftPresentation : sourcePresentation;
  const scene = {
    logo,
    name: activeName,
    variants,
    mockupLogoId,
    mockupCandidateId,
  };
  const editCtx = useMemo(
    () => ({
      editing: editable && editing,
      catchphrase: activePresentation.catchphrase ?? "",
      story: activePresentation.story ?? "",
      sceneLeads: Object.fromEntries(
        Object.entries(activePresentation.sceneTexts ?? {}).map(([slug, t]) => [
          slug,
          t.lead,
        ])
      ),
      save: (patch: PresentationPatch) =>
        setDraftPresentation((current) => applyPresentationPatch(current, patch)),
    }),
    [activePresentation, editable, editing]
  );

  useEffect(() => {
    let alive = true;
    fetchPresentationCatalog()
      .then((catalog) => {
        if (alive) setAssetCatalog(catalog);
      })
      .catch(() => {
        if (alive) {
          setAssetCatalog({ definitions: [], brokenItems: [] });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const mockupEntries = useMemo(() => {
    return resolvePresentationAssets(
      assetCatalog?.definitions ?? [],
      activePresentation.layout ?? emptyPresentation().layout,
    );
  }, [activePresentation.layout, assetCatalog?.definitions]);

  const assetDefinitions = assetCatalog?.definitions ?? [];

  const socialEntries = mockupEntries.filter((entry) => entry.placement.scene === "social");
  const onsiteEntries = mockupEntries.filter((entry) => entry.placement.scene === "onsite");
  const merchEntries = mockupEntries.filter((entry) => entry.placement.scene === "merch");
  const generatedEntries = mockupEntries.filter(
    (entry) => entry.placement.scene === "generated",
  );

  const handleEditButton = async () => {
    if (!editable) return;
    if (!isSignedIn) {
      onRequestSignIn?.();
      return;
    }
    if (!editing) {
      setDraftName(name);
      setDraftPresentation(sourcePresentation);
      setEditing(true);
      return;
    }
    if (saving) return;
    (document.activeElement as HTMLElement | null)?.blur();
    await Promise.resolve();
    setSaving(true);
    try {
      await onCommitEdits?.({
        name: draftName.trim() || name,
        presentation: draftPresentation,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="bg-paper text-ink">
      <AppHeader
        sticky
        section={`${dict.doc.brandGuidelines} — ${name}`}
        actions={
          <>
            {editable && (
              <button
                type="button"
                onClick={() => void handleEditButton()}
                aria-pressed={editing}
                className={cn(
                  "bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60",
                )}
                disabled={saving}
              >
                {editing ? dict.header.editDone : dict.header.edit}
              </button>
            )}
            {editing ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                aria-label={dict.header.brandName}
                className="w-40 border-b border-hairline bg-transparent px-1 py-1.5 text-sm focus:border-ink focus:outline-none"
              />
            ) : (
              <p className="max-w-40 truncate font-mono text-xs uppercase text-ink-muted">
                {activeName}
              </p>
            )}
            <button
              type="button"
              onClick={onReset}
              className="bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              {dict.header.newLogo}
            </button>
          </>
        }
      />

      <PresentationEditProvider value={editCtx}>
      {editable && editing && (
        <PresentationLayoutEditor
          definitions={assetDefinitions}
          layout={activePresentation.layout ?? emptyPresentation().layout}
          onSaveLayout={(layout) =>
            setDraftPresentation((current) =>
              applyPresentationPatch(current, { layout }),
            )
          }
        />
      )}
      <Splash {...scene} />
      <Contents />
      {/* Anchor wrappers for the table of contents; offset for the sticky header. */}
      <div id="s01" className="scroll-mt-16">
        <Identity {...scene} />
      </div>
      <div id="s02" className="scroll-mt-16">
        <Construction {...scene} />
      </div>
      <div id="s03" className="scroll-mt-16">
        <Palette {...scene} />
      </div>
      <div id="s04" className="scroll-mt-16">
        <UsageGrid {...scene} />
      </div>
      <div id="s05" className="scroll-mt-16">
        <AppIcons {...scene} />
      </div>
      <div id="s06" className="scroll-mt-16">
        <Browser {...scene} />
      </div>
      <div id="s07" className="scroll-mt-16">
        <MockupScene
          n="07"
          title={dict.scenes.social}
          lead={dict.sections.social.lead}
          slug="social"
          scene={scene}
          entries={socialEntries}
        />
      </div>
      <div id="s08" className="scroll-mt-16">
        <MockupScene
          n="08"
          title={dict.scenes.onsite}
          lead={dict.sections.onsite.lead}
          slug="onsite"
          scene={scene}
          entries={onsiteEntries}
        />
      </div>
      <div id="s09" className="scroll-mt-16">
        <MockupScene
          n="09"
          title={dict.scenes.merch}
          lead={dict.sections.merch.lead}
          slug="merch"
          scene={scene}
          entries={merchEntries}
        />
      </div>
      <div id="s10" className="scroll-mt-16">
        <MockupScene
          n="10"
          title={dict.scenes.generated}
          lead={dict.sections.generated.lead}
          slug="generated"
          scene={scene}
          entries={generatedEntries}
        />
      </div>
      </PresentationEditProvider>

      <footer className="flex items-center justify-between border-t border-hairline px-6 py-10 md:px-12">
        <p className="font-mono text-xs uppercase text-ink-muted">
          {format(dict.footer.generatedWith, { service: SERVICE_NAME })}
        </p>
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}`}
            className="font-mono text-xs uppercase text-ink-muted transition-colors hover:text-accent"
          >
            {dict.footer.contact}
            <span aria-hidden="true"> →</span>
          </a>
        )}
        <p className="font-mono text-xs uppercase text-ink-muted">
          {dict.doc.version} 1.0 — {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
