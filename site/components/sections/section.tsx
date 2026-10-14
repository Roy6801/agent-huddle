import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-14 border-t", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <h2 id={`${id}-title`} className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {title}
          </h2>
          {intro && <p className="mt-3 text-pretty text-muted-foreground">{intro}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}
