import { NextResponse, type NextRequest } from "next/server";

import { getSessionClaims } from "@/server/auth/session";
import { log } from "@/server/log";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Download a private attachment. RLS decides who can see the file record; the uploader can always
 * download, everyone else only after a clean scan. Storage policies check the same rule again
 * when the short-lived signed URL is created.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/files/[id]">) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const { data: file } = await session.supabase
    .from("file_objects")
    .select("bucket, path, display_name, scan_status, owner_user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!file || file.bucket !== "attachments" || file.deleted_at) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const mine = file.owner_user_id === session.userId;
  if (file.scan_status === "infected" || (!mine && file.scan_status !== "clean")) {
    return NextResponse.json({ error: "not_available" }, { status: 403, headers: NO_STORE });
  }

  const { data, error } = await session.supabase.storage
    .from("attachments")
    .createSignedUrl(file.path, 60, { download: file.display_name ?? "file" });
  if (error || !data?.signedUrl) {
    log.warn("files.sign_failed", { message: error?.message });
    return NextResponse.json({ error: "not_available" }, { status: 403, headers: NO_STORE });
  }
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
