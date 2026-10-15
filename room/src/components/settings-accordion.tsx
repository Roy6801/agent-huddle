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
      {/* Clip, not hide: hidden content is still scrollable, and focus scrolled it sideways. The side padding holds the
          Change buttons' -mr-2 and the switch's wider hit area. */}
      <CollapsibleContent className="-mx-3 overflow-clip px-3 pb-1 motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <div className="flex flex-col gap-6 pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
