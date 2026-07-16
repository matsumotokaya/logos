import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Template2D } from "@/labs/workflow/core/template-format";
import {
  CODE_PRESENTATION_MOCKUPS,
  type BuiltinPresentationMockup,
} from "@/lib/presentation-mockups";
import WorkflowTemplatePage from "@/labs/workflow/components/WorkflowTemplatePage";
import WorkflowBuiltinMockupPage from "@/labs/workflow/components/WorkflowBuiltinMockupPage";
import WorkflowRuntimeMockupPage from "@/labs/workflow/components/WorkflowRuntimeMockupPage";
import { listTemplates, loadTemplate } from "@/labs/workflow/engine/registry";

export const metadata: Metadata = {
  title: "Workflow Template",
  robots: { index: false, follow: false },
};

export async function generateStaticParams() {
  const templates = await listTemplates();
  return [
    ...CODE_PRESENTATION_MOCKUPS.filter((entry) => entry.sourceLab === "workflow").map(
      (entry) => ({ templateId: entry.id }),
    ),
    ...templates
    .filter((entry) => entry.template && entry.errors.length === 0)
    .map((entry) => ({
      templateId: entry.id,
    })),
  ];
}

export default async function WorkflowTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const codeDefinition = CODE_PRESENTATION_MOCKUPS.find(
    (entry) => entry.sourceLab === "workflow" && entry.id === templateId,
  );
  if (codeDefinition?.kind === "runtime") {
    return <WorkflowRuntimeMockupPage mockup={codeDefinition} />;
  }
  if (codeDefinition?.kind === "builtin") {
    return (
      <WorkflowBuiltinMockupPage
        mockup={codeDefinition as BuiltinPresentationMockup}
      />
    );
  }
  let template: Template2D;

  try {
    ({ template } = await loadTemplate(templateId));
  } catch {
    notFound();
  }

  return <WorkflowTemplatePage template={template} />;
}
