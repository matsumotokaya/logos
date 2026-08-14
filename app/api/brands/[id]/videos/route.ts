// Videos of one brand — the portal's list and its "add a video" action.
//
// Every listed video is a V2 Take. POST chooses the immutable template and
// creates that Take; there are no synthetic rows or legacy asset fallbacks.

import { guardLabsRequest } from "@/lib/labs-access";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { isVideoTemplateId, VIDEO_TEMPLATES } from "@/lib/video/templates";
import { type VideoState, type VideoSummary } from "@/lib/video/asset";
import { emptyEventBrief } from "@/remotion/event/briefs";
import { createTake } from "@/lib/takes/create";
import { seedEventCmFromBrand } from "@/lib/event-cm/seed-from-brand";
import { UNTITLED_VIDEO } from "@/lib/event-cm/title";
import { draftEventCmScript, eventCmScriptAvailable } from "@/lib/event-cm/script";

type TakeVideoRow = {
  id: string;
  brand_id: string;
  template_id: string;
  title: string;
  brief: unknown;
  created_at: string;
  take_renders: Array<{
    status: string;
    latest_artifact_id: string | null;
    publications: Array<{ status: string }> | null;
  }> | null;
};

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

/** MP4 on disk beats a voice track; neither means the slot is still empty. */
function campaignVideoState(jobId: string | null): VideoState {
  if (!jobId) return "empty";
  if (campaignCmMp4Exists(jobId)) return "mp4_ready";
  return getCampaignJob(jobId)?.cm?.track ? "preview_ready" : "empty";
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: brand, error: brandError } = await supabase
    .from("brand_entities")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();
  if (brandError) return Response.json({ error: "ブランドを確認できませんでした" }, { status: 500 });
  if (!brand) return Response.json({ error: "ブランドが見つかりません" }, { status: 404 });

  const [takeResult, lpTakeResult] = await Promise.all([
    supabase
      .from("takes")
      .select(
        "id, brand_id, template_id, title, brief, created_at, take_renders(status, latest_artifact_id, publications(status))",
      )
      .eq("brand_id", brandId)
      .eq("tool_kind", "video")
      .order("created_at", { ascending: true }),
    supabase
      .from("takes")
      .select("brief")
      .eq("brand_id", brandId)
      .eq("template_id", "campaign-lp")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (takeResult.error || lpTakeResult.error) {
    return Response.json({ error: "アセットを取得できませんでした" }, { status: 500 });
  }
  const lpBrief = lpTakeResult.data?.brief as Record<string, unknown> | null;
  const campaignJobId =
    typeof lpBrief?.campaignJobId === "string" ? lpBrief.campaignJobId : null;

  const videos: VideoSummary[] = [];
  const v2Videos = (takeResult.data ?? []) as unknown as TakeVideoRow[];
  for (const take of v2Videos) {
    if (!isVideoTemplateId(take.template_id)) continue;
    const brief = take.brief as Record<string, unknown> | null;
    const renderReady = (take.take_renders ?? []).some(
      (render) => render.status === "ready" && render.latest_artifact_id,
    );
    const published = (take.take_renders ?? []).some((render) =>
      (render.publications ?? []).some((publication) => publication.status === "live"),
    );
    const takeJobId =
      typeof brief?.campaignJobId === "string" ? brief.campaignJobId : null;
    videos.push({
      id: take.id,
      brandId: take.brand_id,
      template: take.template_id,
      title: take.title,
      published,
      state:
        take.template_id === "product-cm"
          ? campaignVideoState(takeJobId ?? campaignJobId)
          : renderReady
            ? "mp4_ready"
            : take.brief
              ? "preview_ready"
              : "empty",
      createdAt: take.created_at,
      isPlaceholder: false,
    });
  }

  videos.sort((left, right) => {
    if (left.template === right.template) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    if (left.template === "product-cm") return -1;
    if (right.template === "product-cm") return 1;
    return 0;
  });

  return Response.json({ brand: { id: brand.id, name: brand.name }, videos });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  let body: { template?: unknown; title?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "リクエストを解釈できませんでした" }, { status: 400 });
  }

  const template = typeof body.template === "string" ? body.template : "";
  if (!isVideoTemplateId(template)) {
    return Response.json({ error: "テンプレートが不正です" }, { status: 400 });
  }
  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";

  let title = requestedTitle;
  let brief: unknown;
  let pinMaterial: { id: string; checksum: string } | null = null;

  if (template === "event-cm") {
    // Seeded, not empty. The take arrives as a finished film: the brand's own
    // palette and mark, an event archetype inferred from its industry, and a
    // plausible date — every guess labelled in the brief's provenance so the
    // screen can say which parts are proposals (§17.5).
    const seeded = await seedEventCmFromBrand(supabase, {
      brandId,
      userId: user.id,
    });
    if (!seeded.ok) {
      return Response.json({ error: seeded.error }, { status: 500 });
    }
    let seededBrief = seeded.seeded.brief;
    if (title.trim()) seededBrief = { ...seededBrief, title: title.trim() };

    // Narration comes with the film, like the music does. The golden path is
    // that nobody is asked for anything: add a video and it plays, with words
    // and a soundtrack. Writing it here rather than on first open means the
    // take is never briefly a silent film with no script.
    //
    // A failure here does not fail the creation. The take is complete without
    // a script — the timeline falls back to the scene budget — and the
    // narration can be written from the pipeline afterwards.
    if (eventCmScriptAvailable()) {
      try {
        const draft = await draftEventCmScript(seededBrief, {
          now: new Date().toISOString(),
        });
        seededBrief = { ...seededBrief, script: draft.script };
      } catch {
        // Left empty on purpose; the screen says the script is missing.
      }
    }

    brief = seededBrief;
    pinMaterial = seeded.seeded.logoMaterial;
    // Not the seeded event name: that is a proposal for the *film*, and using
    // it as the video's name made a guess look like something somebody typed
    // (lib/event-cm/title.ts).
    if (!title) title = UNTITLED_VIDEO;
  } else if (template === "event-promo") {
    // The template IS the starting point. Copying an existing take as a
    // "base" was a way of getting materials before the take had its own input
    // stage; now it has one, and offering a video to build from asked the
    // user to pick a template twice.
    brief = emptyEventBrief(title || UNTITLED_VIDEO);
    if (!title) title = UNTITLED_VIDEO;
  } else {
    // product-cm is driven by the campaign pipeline; the row records which job
    // owns the Brand Kit and narration.
    const { data: lpTake, error: lpTakeError } = await supabase
      .from("takes")
      .select("brief")
      .eq("brand_id", brandId)
      .eq("template_id", "campaign-lp")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lpTakeError) {
      return Response.json(
        { error: "製品紹介動画のBrand Kitを確認できませんでした" },
        { status: 500 },
      );
    }
    const lpTakeBrief = lpTake?.brief as Record<string, unknown> | null;
    const jobId =
      typeof lpTakeBrief?.campaignJobId === "string" ? lpTakeBrief.campaignJobId : null;
    const job = jobId ? getCampaignJob(jobId) : null;
    brief = {
      kit: lpTakeBrief?.kit ?? job?.kit ?? null,
      campaignJobId: jobId,
      sourceUrl:
        (typeof lpTakeBrief?.sourceUrl === "string" ? lpTakeBrief.sourceUrl : null) ??
        job?.input.url ??
        null,
      theme:
        (typeof lpTakeBrief?.theme === "string" ? lpTakeBrief.theme : null) ??
        job?.kit?.theme ??
        null,
    };
    if (!title) title = VIDEO_TEMPLATES["product-cm"].name;
  }

  const created = await createTake(supabase, {
    brandId,
    templateId: template,
    title,
    brief,
    createdBy: user.id,
  });
  if (!created.ok) {
    return Response.json(
      { error: created.error },
      { status: 500 },
    );
  }

  if (pinMaterial) {
    // The brief points at material:<uuid>; the pin is what lets both the
    // preview resolver and the renderer read those bytes, and what fixes the
    // exact version this take consumes.
    const { error: pinError } = await supabase.from("take_inputs").insert({
      take_id: created.takeId,
      material_id: pinMaterial.id,
      role: "logo",
      checksum: pinMaterial.checksum,
    });
    if (pinError) {
      return Response.json(
        { error: `ロゴを入力として固定できませんでした: ${pinError.message}` },
        { status: 500 },
      );
    }
  }

  return Response.json(
    { id: created.takeId, createdAt: new Date().toISOString() },
    { status: 201 },
  );
}
