import { Badge } from "@/components/ui/badge";

export function NextSteps({ title, steps, comingSoon }: { title: string; steps: string[]; comingSoon: string }) {
  return (
    <section aria-labelledby="next-steps" className="rounded-lg border border-line bg-surface">
      <h2 id="next-steps" className="border-b border-line px-5 py-3.5 font-semibold">
        {title}
      </h2>
      <ol className="divide-y divide-line">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-4 px-5 py-3.5">
            <span className="font-mono text-sm text-accent">{index + 1}</span>
            <span className="flex-1">{step}</span>
            <Badge>{comingSoon}</Badge>
          </li>
        ))}
      </ol>
    </section>
  );
}
