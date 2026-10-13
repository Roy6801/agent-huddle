"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Toggle dark mode"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <SunIcon className="hidden dark:block" aria-hidden />
          <MoonIcon className="dark:hidden" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        Toggle theme
      </TooltipContent>
    </Tooltip>
  );
}
