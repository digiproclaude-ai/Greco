import "server-only";

import { createHash } from "node:crypto";

import { log } from "@/server/log";
import { failed, type ActionState } from "@/server/modules/shared/action-state";
import type { UserContext } from "@/server/modules/shared/context";

import { sniffMimeType } from "./sniff";

/** Private attachments for messages and projects. Vercel limits request bodies to 4.5 MB. */
export const MAX_ATTACHMENT_MB = 4;
const MAX_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;
const BUCKET = "attachments";

export type AttachmentPurpose = "message_attachment" | "project_attachment";

export async function uploadPrivateFile(
  ctx: Pick<UserContext, "supabase" | "userId">,
  file: unknown,
  purpose: AttachmentPurpose,
): Promise<{ fileId: string } | { failure: ActionState }> {
  if (!(file instanceof File) || file.size === 0) return { failure: failed("attachmentType") };
  if (file.size > MAX_BYTES) return { failure: failed("attachmentTooLarge", { errorValues: { max: MAX_ATTACHMENT_MB } }) };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMimeType(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)), file.name);
  if (!mime) return { failure: failed("attachmentType") };

  const path = `${ctx.userId}/${purpose}/${crypto.randomUUID()}`;
  const { error: uploadError } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    log.warn("attachments.upload_failed", { message: uploadError.message });
    return { failure: failed("uploadFailed") };
  }

  const displayName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "file";
  const { data: fileId, error } = await ctx.supabase.rpc("register_private_file", {
    p_path: path,
    p_purpose: purpose,
    p_mime: mime,
    p_size: bytes.byteLength,
    p_sha256: createHash("sha256").update(bytes).digest("hex"),
    p_display_name: displayName,
  });
  if (error || !fileId) {
    log.warn("attachments.register_failed", { code: error?.code });
    await ctx.supabase.storage.from(BUCKET).remove([path]);
    return { failure: failed("uploadFailed") };
  }
  return { fileId };
}

export type AttachmentInfo = {
  id: string;
  name: string;
  size: number;
  mime: string;
  scanStatus: string;
  mine: boolean;
};
