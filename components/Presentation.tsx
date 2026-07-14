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
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Account from "@/components/Account";
import MainNav from "@/components/MainNav";
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
  onNameChange: (name: string) => void;
  onReset: () => void;
  /** Creator contact address; renders a mailto link in the footer when set. */
  contactEmail?: string | null;
  /** Editorial copy + per-logo presentation layout overrides. */
  presentation?: LogoPresentation | null;
  /** Present when the viewer may edit presentation copy/layout in place. */
  onSavePresentation?: (patch: PresentationPatch) => void;
};

export default function Presentation({
  logo,
  name,
  mockupLogoId,
  mockupCandidateId,
  onNameChange,
  onReset,
  contactEmail,
  presentation,
  onSavePresentation,
}: Props) {
  const { dict, format } = useI18n();
  const [editing, setEditing] = useState(false);
  const [assetCatalog, setAssetCatalog] = useState<PresentationCatalogResponse | null>(null);
  const variants = useMemo<Variants>(
    () => ({
      white: recolorSvg(logo.svg, "#F4F4F2"),
      black: recolorSvg(logo.svg, "#101012"),
    }),
    [logo.svg]
  );

  const scene = { logo, name, variants, mockupLogoId, mockupCandidateId };
  const editable = onSavePresentation !== undefined;
  const editCtx = useMemo(
    () => ({
      editing: editable && editing,
      catchphrase: presentation?.catchphrase ?? "",
      story: presentation?.story ?? "",
      sceneLeads: Object.fromEntries(
        Object.entries(presentation?.sceneTexts ?? {}).map(([slug, t]) => [
          slug,
          t.lead,
        ])
      ),
      save: onSavePresentation ?? (() => {}),
    }),
    [editable, editing, presentation, onSavePresentation]
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
      presentation?.layout ?? emptyPresentation().layout,
    );
  }, [assetCatalog?.definitions, presentation?.layout]);

  const assetDefinitions = assetCatalog?.definitions ?? [];

  const socialEntries = mockupEntries.filter((entry) => entry.placement.scene === "social");
  const onsiteEntries = mockupEntries.filter((entry) => entry.placement.scene === "onsite");
  const merchEntries = mockupEntries.filter((entry) => entry.placement.scene === "merch");
  const generatedEntries = mockupEntries.filter(
    (entry) => entry.placement.scene === "generated",
  );

  return (
    <main className="bg-paper text-ink">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-paper/90 px-6 py-4 backdrop-blur-sm md:px-12">
        <div className="flex items-baseline gap-4">
          <p className="font-display text-base font-medium">
            {SERVICE_NAME}
            <span className="align-super text-[10px]">®</span>
          </p>
          <p className="hidden font-mono text-xs uppercase text-ink-muted sm:block">
            {dict.doc.brandGuidelines} — {name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Account />
          <MainNav />
          {editable && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className={cn(
                "border px-4 py-1.5 text-sm font-medium transition-colors",
                editing
                  ? "border-accent bg-accent text-paper"
                  : "border-hairline text-ink-muted hover:border-ink hover:text-ink"
              )}
            >
              {editing ? dict.header.editDone : dict.header.edit}
            </button>
          )}
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label={dict.header.brandName}
            className="w-40 border-b border-hairline bg-transparent px-1 py-1.5 text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={onReset}
            className="bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            {dict.header.newLogo}
          </button>
        </div>
      </header>

      <PresentationEditProvider value={editCtx}>
      {editable && editing && (
        <PresentationLayoutEditor
          definitions={assetDefinitions}
          layout={presentation?.layout ?? emptyPresentation().layout}
          onSaveLayout={(layout) => onSavePresentation?.({ layout })}
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
