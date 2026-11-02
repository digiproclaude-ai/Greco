import Image from "next/image";

import { publicMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function Avatar({ path, name, size = 48, className }: { path: string | null; name: string; size?: number; className?: string }) {
  const url = publicMediaUrl(path);
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper font-display text-ink-muted", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {url ? (
        <Image src={url} alt="" width={size} height={size} className="size-full object-cover" unoptimized />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
