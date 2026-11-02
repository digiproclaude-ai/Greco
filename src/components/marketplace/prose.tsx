/**
 * User-written text shown as paragraphs. Plain text only (no HTML or Markdown at launch), so
 * nothing the user writes can inject markup; React escapes everything (SECURITY.md §5).
 */
export function Prose({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={className ?? "grid max-w-[68ch] gap-3 leading-relaxed"}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
