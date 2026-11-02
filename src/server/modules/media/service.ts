import "server-only";

import type { ActionState } from "@/server/modules/shared/action-state";
import { failed } from "@/server/modules/shared/action-state";
import type { UserContext } from "@/server/modules/shared/context";
import { log } from "@/server/log";

import { processImage, type ImageKind } from "./images";

const BUCKET = "public-media";

/**
 * Validate, re-encode and store an uploaded image in the user's own folder, then register it.
 * Returns the new file id, or an ActionState describing the problem.
 */
export async function uploadPublicImage(
  ctx: Pick<UserContext, "supabase" | "userId">,
  file: unknown,
  kind: ImageKind,
): Promise<{ fileId: string; path: string } | { failure: ActionState }> {
  const processed = await processImage(file, kind);
  if ("error" in processed) {
    return { failure: failed(processed.error, "values" in processed ? { errorValues: processed.values } : {}) };
  }

  const path = `${ctx.userId}/${kind}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(path, processed.image.buffer, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploadError) {
    log.warn("media.upload_failed", { kind, message: uploadError.message });
    return { failure: failed("uploadFailed") };
  }

  const { data: fileId, error } = await ctx.supabase.rpc("register_uploaded_file", {
    p_path: path,
    p_purpose: kind,
    p_mime: "image/webp",
    p_size: processed.image.buffer.byteLength,
    p_sha256: processed.image.sha256,
  });
  if (error || !fileId) {
    log.warn("media.register_failed", { kind, code: error?.code });
    await ctx.supabase.storage.from(BUCKET).remove([path]);
    return { failure: failed("uploadFailed") };
  }
  return { fileId, path };
}

/** Discard an image nothing uses any more and delete the stored object. Best effort. */
export async function discardPublicImage(ctx: Pick<UserContext, "supabase">, fileId: string | null | undefined) {
  if (!fileId) return;
  const { data: path, error } = await ctx.supabase.rpc("discard_uploaded_file", { p_file_id: fileId });
  if (error || !path) {
    if (error?.code !== "55000") log.warn("media.discard_failed", { code: error?.code });
    return;
  }
  const { error: removeError } = await ctx.supabase.storage.from(BUCKET).remove([path]);
  if (removeError) log.warn("media.remove_failed", { message: removeError.message });
}
