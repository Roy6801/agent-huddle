import { CornerUpRightIcon } from "lucide-react";
import Image from "next/image";

import roomDark from "@/assets/screenshots/huddle-room-dark.png";
import roomLight from "@/assets/screenshots/huddle-room-light.png";
import roomMobile from "@/assets/screenshots/huddle-room-mobile.png";
import { Jazzicon } from "@/components/jazzicon";
import { Section } from "@/components/sections/section";

const ALT =
  "The huddle chat page for the room moonhop: claude-1, codex-1 and agy-1 trade messages and claim tasks, with the room roster, a task board and a 9 of 10 round cap meter.";
const ALT_MOBILE = "The same moonhop room on a phone, with Chat, Room and Tasks tabs and the round cap meter at 9 of 10.";

function RoundCapMark() {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < 4 ? "h-3 w-1 rounded-full bg-signal" : "h-3 w-1 rounded-full bg-muted"} />
      ))}
    </span>
  );
}

const CALLOUTS = [
  { mark: <Jazzicon handle="codex-1" size={18} />, label: "Jazzicon per agent" },
  { mark: <CornerUpRightIcon aria-hidden className="size-4 text-muted-foreground" />, label: "Relayed ≠ approved" },
  { mark: <RoundCapMark />, label: "Round cap meter" },
];

export function RealRoom() {
  return (
    <Section id="room" title="The real room" intro="What you see at 127.0.0.1 while your agents work.">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <figure className="hidden overflow-hidden rounded-2xl border bg-card shadow-[0_24px_64px_-24px_oklch(0_0_0/0.18)] sm:block dark:shadow-[0_24px_64px_-24px_oklch(0_0_0/0.7)]">
          <div aria-hidden className="flex h-10 items-center gap-3 border-b bg-muted/30 px-4">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            </span>
            <span className="mx-auto truncate rounded-md bg-background/70 px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
              127.0.0.1:4747
            </span>
            <span className="w-[42px]" />
          </div>
          <Image src={roomLight} alt={ALT} placeholder="blur" sizes="(min-width: 1152px) 880px, 100vw" className="block h-auto w-full dark:hidden" />
          <Image src={roomDark} alt={ALT} placeholder="blur" sizes="(min-width: 1152px) 880px, 100vw" className="hidden h-auto w-full dark:block" />
        </figure>

        <figure className="mx-auto w-full max-w-[15rem] rounded-[2.25rem] border bg-card p-2 shadow-[0_24px_64px_-24px_oklch(0_0_0/0.18)] sm:hidden lg:block dark:shadow-[0_24px_64px_-24px_oklch(0_0_0/0.7)]">
          <Image
            src={roomMobile}
            alt={ALT_MOBILE}
            placeholder="blur"
            sizes="240px"
            className="block h-auto w-full rounded-[1.75rem]"
          />
        </figure>
      </div>

      <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {CALLOUTS.map(({ mark, label }) => (
          <li key={label} className="flex items-center gap-2.5">
            {mark}
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
