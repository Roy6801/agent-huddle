import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export function CodeBlock({
  children,
  title,
  copy,
  copyLabel,
  wrap = false,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  copy?: string;
  copyLabel?: string;
  wrap?: boolean;
  className?: string;
}) {
  const hasHeader = Boolean(title || copy);

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border bg-muted/40 dark:bg-muted/25", className)}>
      {hasHeader && (
        <div className="flex min-h-11 items-center justify-between gap-2 border-b pl-4 pr-1">
          <span className="truncate font-mono text-xs text-muted-foreground">{title}</span>
          {copy && <CopyButton text={copy} label={copyLabel ?? "Copy code"} />}
        </div>
      )}
      <pre
        tabIndex={0}
        className={cn(
          "overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-foreground sm:text-[13px]",
          wrap && "whitespace-pre-wrap wrap-anywhere",
        )}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Prompt() {
  return <span className="select-none text-muted-foreground/70">$ </span>;
}

export function Out({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export function Hl({ children }: { children: React.ReactNode }) {
  return <span className="text-signal">{children}</span>;
}
