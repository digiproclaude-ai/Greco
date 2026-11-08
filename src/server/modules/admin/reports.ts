import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";

type Client = SupabaseClient<Database>;

export const REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;

export async function listReports(supabase: Client, status: (typeof REPORT_STATUSES)[number]) {
  const { data } = await supabase
    .from("content_reports")
    .select("id, target_type, target_id, reason, source, signals, status, details, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status !== "open" ? false : true })
    .limit(100);
  return data ?? [];
}

/** A report with what moderators need to decide. Message context is fetched through an audited function. */
export async function getReportDetail(supabase: Client, reportId: string) {
  const { data: report } = await supabase.from("content_reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) return null;
  const id = report.target_id;
  switch (report.target_type) {
    case "message": {
      const { data: thread } = await supabase.rpc("admin_reported_message", { p_report_id: reportId });
      const reported = (thread ?? []).find((m) => m.is_reported);
      return { report, kind: "message" as const, thread: thread ?? [], reported: reported ?? null };
    }
    case "project": {
      const { data: project } = await supabase.from("projects").select("id, title, description, status, client_user_id").eq("id", id).maybeSingle();
      return { report, kind: "project" as const, project };
    }
    case "provider": {
      const { data: provider } = await supabase.from("providers").select("id, handle, display_name, headline, status").eq("id", id).maybeSingle();
      return { report, kind: "provider" as const, provider };
    }
    case "listing": {
      const { data: listing } = await supabase
        .from("service_listings")
        .select("id, title, slug, status, providers (handle, display_name)")
        .eq("id", id)
        .maybeSingle();
      return { report, kind: "listing" as const, listing };
    }
    case "user": {
      const { data: profile } = await supabase.from("profiles").select("id, full_name, display_name, account_status").eq("id", id).maybeSingle();
      return { report, kind: "user" as const, profile };
    }
    case "proposal": {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("id, status, proposed_solution, providers (handle, display_name), projects (title)")
        .eq("id", id)
        .maybeSingle();
      return { report, kind: "proposal" as const, proposal };
    }
    default:
      return { report, kind: "other" as const };
  }
}

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof getReportDetail>>>;
