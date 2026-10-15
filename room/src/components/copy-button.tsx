import { CheckIcon } from "lucide-react";
import { useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { RoomContext } from "@/hooks/use-room";
import { copyText } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label,
  icon,
  labelClassName,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  text: string;
  label: string;
  icon: ReactNode;
  labelClassName?: string;
}) {
  // The home page has no room to speak through; the label still changes to "Copied".
  const announce = useContext(RoomContext)?.announce;
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Button
      type="button"
      className={cn(done && "text-presence hover:text-presence", className)}
      onClick={async () => {
        if (!text) return;
        if (!(await copyText(text))) {
          window.prompt("Copy this:", text);
          return;
        }
        setDone(true);
        announce?.("Copied to clipboard");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1600);
      }}
      {...props}
    >
      {done ? <CheckIcon aria-hidden /> : icon}
      <span className={labelClassName}>{done ? "Copied" : label}</span>
    </Button>
  );
}
