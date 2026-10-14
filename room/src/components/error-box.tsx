import { CircleAlertIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorInfo = { message: string; valid?: string[] | null; validLabel?: string };

export function ErrorBox({
  error,
  onDismiss,
  className,
}: {
  error: ErrorInfo;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 py-2 pr-1 pl-3 text-[13px] leading-5 text-destructive",
        !onDismiss && "pr-3",
        className,
      )}
    >
      <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">
        <div>{error.message}</div>
        {error.valid && error.valid.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span>{error.validLabel}:</span>
            {error.valid.map((v) => (
              <span key={v} className="rounded bg-muted px-1 font-mono text-xs text-foreground">
                {v.startsWith("@") ? v : `@${v}`}
              </span>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-my-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Dismiss error"
          onClick={onDismiss}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}
