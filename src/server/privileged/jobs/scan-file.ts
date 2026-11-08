import "server-only";

import { getFileScanner } from "@/server/adapters/scanning";
import { log } from "@/server/log";

import { createSupabaseAdminClient } from "../supabase-admin";

/**
 * Scan an uploaded private file and record the verdict. Without a configured scanner the file
 * stays "pending": its uploader can still open it, nobody else can.
 */
export async function scanUploadedFile(fileId: string) {
  const scanner = getFileScanner();
  if (!scanner) {
    log.info("scan.not_configured", { fileId });
    return;
  }
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("file_scan_target", { p_file_id: fileId });
  if (error) throw new Error(`file_scan_target failed: ${error.message}`);
  const target = rows?.[0];
  if (!target || target.scan_status !== "pending") return;

  const { data: blob, error: downloadError } = await supabase.storage.from(target.bucket).download(target.path);
  if (downloadError || !blob) throw new Error(`download failed: ${downloadError?.message ?? "no data"}`);
  const result = await scanner.scan({ bytes: new Uint8Array(await blob.arrayBuffer()), fileName: target.path.split("/").pop() ?? "file" });
  // Scanner errors are retried by the outbox; only real verdicts are recorded.
  if (result.verdict === "error") throw new Error(`scan error: ${result.detail ?? "unknown"}`);
  const { error: recordError } = await supabase.rpc("file_record_scan", {
    p_file_id: fileId,
    p_status: result.verdict,
    p_detail: result.detail,
  });
  if (recordError) throw new Error(`file_record_scan failed: ${recordError.message}`);
  if (result.verdict === "infected") log.warn("scan.infected", { fileId });
}
