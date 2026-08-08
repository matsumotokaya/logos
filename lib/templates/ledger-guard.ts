export interface RecordedTemplateVersion {
  template_id: string;
  version: number;
  definition_hash: string;
  stage: string;
}

export interface CandidateTemplateVersion {
  template_id: string;
  version: number;
  definition_hash: string;
}

/** Released versions are immutable evidence. Draft definitions may still move. */
export function productionTemplateDrift(
  existing: RecordedTemplateVersion[],
  candidates: CandidateTemplateVersion[],
): string[] {
  const before = new Map(
    existing.map((row) => [`${row.template_id}@${row.version}`, row]),
  );
  return candidates
    .filter((row) => {
      const previous = before.get(`${row.template_id}@${row.version}`);
      return (
        previous?.stage === "production" &&
        previous.definition_hash !== row.definition_hash
      );
    })
    .map((row) => `${row.template_id}@${row.version}`);
}
