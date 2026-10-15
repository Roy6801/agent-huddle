import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** The room's settings behind one borderless, collapsed-by-default disclosure. */
export function SettingsAccordion({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="group/settings">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronRightIcon aria-hidden className="size-3.5 transition-transform group-data-[state=open]/settings:rotate-90 motion-reduce:transition-none" />
        Settings
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <div className="flex flex-col gap-6 pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
