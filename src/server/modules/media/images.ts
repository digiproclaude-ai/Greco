import "server-only";

import { createHash } from "node:crypto";

import sharp, { type Metadata, type ResizeOptions } from "sharp";

/**
 * Image intake for public media (SECURITY.md §6): the format is detected from the file's bytes,
 * the image is decoded, re-oriented, resized and re-encoded to WebP. Re-encoding drops EXIF and
 * GPS metadata. Vercel limits request bodies to 4.5 MB, so uploads are capped at 4 MB.
 */
export const MAX_UPLOAD_MB = 4;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ImageKind = "avatar" | "listing_media" | "portfolio_media";

const SPECS: Record<ImageKind, { minSide: number; resize: ResizeOptions }> = {
  avatar: { minSide: 160, resize: { width: 400, height: 400, fit: "cover", position: "attention" } },
  listing_media: { minSide: 400, resize: { width: 1600, height: 1600, fit: "inside", withoutEnlargement: true } },
  portfolio_media: { minSide: 400, resize: { width: 1600, height: 1600, fit: "inside", withoutEnlargement: true } },
};

export type ProcessedImage = { buffer: Buffer; width: number; height: number; sha256: string };

export type ImageError =
  | { error: "fileType" }
  | { error: "fileTooLarge"; values: { max: number } }
  | { error: "fileDimensions"; values: { min: number } };

export async function processImage(file: unknown, kind: ImageKind): Promise<{ image: ProcessedImage } | ImageError> {
  if (!(file instanceof File) || file.size === 0) return { error: "fileType" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "fileTooLarge", values: { max: MAX_UPLOAD_MB } };

  const input = Buffer.from(await file.arrayBuffer());
  const spec = SPECS[kind];

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return { error: "fileType" };
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) return { error: "fileType" };
  if ((metadata.width ?? 0) < spec.minSide || (metadata.height ?? 0) < spec.minSide) {
    return { error: "fileDimensions", values: { min: spec.minSide } };
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .resize(spec.resize)
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return {
      image: {
        buffer: data,
        width: info.width,
        height: info.height,
        sha256: createHash("sha256").update(data).digest("hex"),
      },
    };
  } catch {
    return { error: "fileType" };
  }
}
