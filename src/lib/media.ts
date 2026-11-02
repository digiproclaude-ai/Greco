import { getPublicEnv } from "./env";

/** Public URL of an image in the public-media bucket (served from the Supabase domain). */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/public-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
