import { MinutesSettings, type Field } from "@/components/minutes-settings";
import { useRoom } from "@/hooks/use-room";
import type { PresenceTimers as Timers } from "@/lib/types";

const FIELDS: Field<keyof Timers>[] = [
  { key: "workingWindowMinutes", label: "Working window", unit: "min", min: 1, max: 120 },
  { key: "asleepMinutes", label: "Asleep after", unit: "min", min: 1, max: 120 },
  { key: "leaveMinutes", label: "Leave after", unit: "min", min: 5, max: 240 },
  { key: "stallMinutes", label: "Stall nudge after", unit: "min", min: 1, max: 60 },
  { key: "releaseMinutes", label: "Release claim after", unit: "min", min: 1, max: 240 },
];

/** How long an agent shows as working after a call, until it shows as asleep, and until it leaves; how long a stalled room waits before a nudge; and how long an asleep agent keeps its claims. */
export function PresenceTimers() {
  const { presenceTimers } = useRoom().state;
  return (
    <MinutesSettings
      id="presence"
      title="Presence"
      noun="presence timers"
      fields={FIELDS}
      values={presenceTimers}
      summary={(p) => `Working ${p.workingWindowMinutes} min · asleep after ${p.asleepMinutes} min · leave after ${p.leaveMinutes} min · stall nudge after ${p.stallMinutes} min · release claims after ${p.releaseMinutes} min silent`}
      validate={(p) => (p.leaveMinutes <= p.asleepMinutes ? "Leave after must be longer than Asleep after." : null)}
    />
  );
}
