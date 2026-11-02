import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";
import type { AttachmentInfo } from "@/server/modules/attachments/service";

type Client = SupabaseClient<Database>;

const PROVIDER_CARD = "id, handle, display_name, headline, country_code, experience_level, avatar:file_objects!providers_avatar_file_id_fkey (path)";

function attachmentsFrom(
  rows: { file_objects: { id: string; display_name: string | null; size_bytes: number; mime_type: string; scan_status: string; owner_user_id: string } | null }[],
  userId: string,
): AttachmentInfo[] {
  return rows.flatMap((row) =>
    row.file_objects
      ? [{
          id: row.file_objects.id,
          name: row.file_objects.display_name ?? "file",
          size: row.file_objects.size_bytes,
          mime: row.file_objects.mime_type,
          scanStatus: row.file_objects.scan_status,
          mine: row.file_objects.owner_user_id === userId,
        }]
      : [],
  );
}

const ATTACHMENT_SELECT = "file_objects (id, display_name, size_bytes, mime_type, scan_status, owner_user_id)";

export async function listClientProjects(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("projects")
    .select("id, title, status, visibility, proposals_count, published_at, expires_at, created_at")
    .eq("client_user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** A project with everything its owner needs (RLS applies). */
export async function getClientProject(supabase: Client, userId: string, projectId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select(`*, project_terms (term_id), project_attachments (${ATTACHMENT_SELECT}),
             project_invitations (id, status, created_at, providers (${PROVIDER_CARD}))`)
    .eq("id", projectId)
    .eq("client_user_id", userId)
    .maybeSingle();
  if (!project) return null;

  const [{ data: proposals }, checklist] = await Promise.all([
    supabase
      .from("proposals")
      .select(`id, status, price_minor, currency, estimated_days, payment_model, deposit_bps, balance_trigger, pricing_model, hours,
               revisions_included, submitted_at, proposed_solution, providers (${PROVIDER_CARD}),
               proposal_milestones (seq, title, amount_minor, due_offset_days)`)
      .eq("project_id", projectId)
      .neq("status", "draft")
      .order("submitted_at", { ascending: true }),
    project.status === "draft" ? supabase.rpc("project_checklist", { p_project_id: projectId }) : Promise.resolve({ data: [] as string[] }),
  ]);

  return {
    project,
    termIds: project.project_terms.map((row) => row.term_id),
    attachments: attachmentsFrom(project.project_attachments, userId),
    invitations: project.project_invitations,
    proposals: (proposals ?? []).map((p) => ({ ...p, proposal_milestones: [...p.proposal_milestones].sort((a, b) => a.seq - b.seq) })),
    missing: checklist.data ?? [],
  };
}

export type ClientProjectData = NonNullable<Awaited<ReturnType<typeof getClientProject>>>;

export async function getProposalForClient(supabase: Client, userId: string, proposalId: string) {
  const { data } = await supabase
    .from("proposals")
    .select(`*, projects!inner (id, title, client_user_id, currency, status), providers (${PROVIDER_CARD}),
             proposal_milestones (id, seq, title, description, amount_minor, due_offset_days),
             proposal_deliverables (id, title, sort_order)`)
    .eq("id", proposalId)
    .eq("projects.client_user_id", userId)
    .neq("status", "draft")
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    proposal_milestones: [...data.proposal_milestones].sort((a, b) => a.seq - b.seq),
    proposal_deliverables: [...data.proposal_deliverables].sort((a, b) => a.sort_order - b.sort_order),
  };
}

/** Open public projects for the expert board, newest first. */
export async function listOpenProjects(supabase: Client, filters: { categoryId?: string | null; q?: string | null }) {
  let query = supabase
    .from("projects")
    .select("id, title, description, category_id, budget_kind, currency, budget_min_minor, budget_max_minor, timeline_kind, proposals_count, published_at, expires_at")
    .eq("status", "open")
    .eq("visibility", "public")
    .gt("expires_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(60);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.q) query = query.ilike("title", `%${filters.q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  return data ?? [];
}

export async function listInvitations(supabase: Client, providerId: string) {
  const { data } = await supabase
    .from("project_invitations")
    .select("id, status, message, created_at, projects (id, title, status, budget_kind, currency, budget_max_minor)")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** A project as an expert sees it, with their own proposal and invitation if any. */
export async function getProjectForExpert(supabase: Client, userId: string, providerId: string, projectId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select(`id, client_user_id, title, description, business_problem, desired_outcome, category_id, budget_kind, currency,
             budget_min_minor, budget_max_minor, timeline_kind, deadline, visibility, status, proposals_count, published_at, expires_at,
             project_terms (term_id), project_attachments (${ATTACHMENT_SELECT})`)
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  const [{ data: proposals }, { data: invitation }] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, status, submitted_at, price_minor, currency")
      .eq("project_id", projectId)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
    supabase.from("project_invitations").select("id, status, message").eq("project_id", projectId).eq("provider_id", providerId).maybeSingle(),
  ]);
  return {
    project,
    termIds: project.project_terms.map((row) => row.term_id),
    attachments: attachmentsFrom(project.project_attachments, userId),
    proposals: proposals ?? [],
    invitation: invitation ?? null,
  };
}

export async function listMyProposals(supabase: Client, providerId: string) {
  const { data } = await supabase
    .from("proposals")
    .select("id, status, price_minor, currency, submitted_at, updated_at, projects (id, title, status)")
    .eq("provider_id", providerId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getProposalEditor(supabase: Client, providerId: string, proposalId: string) {
  const { data } = await supabase
    .from("proposals")
    .select(`*, projects (id, title, currency, status, client_user_id, budget_kind, budget_min_minor, budget_max_minor),
             proposal_milestones (id, seq, title, description, amount_minor, due_offset_days),
             proposal_deliverables (id, title, sort_order)`)
    .eq("id", proposalId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!data) return null;
  const checklist = data.status === "draft" ? await supabase.rpc("proposal_checklist", { p_proposal_id: proposalId }) : { data: [] as string[] };
  return {
    proposal: data,
    milestones: [...data.proposal_milestones].sort((a, b) => a.seq - b.seq),
    deliverables: [...data.proposal_deliverables].sort((a, b) => a.sort_order - b.sort_order),
    missing: checklist.data ?? [],
  };
}
