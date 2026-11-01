export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 grid gap-1.5">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {description ? <p className="text-[15px] text-ink-muted">{description}</p> : null}
    </div>
  );
}
