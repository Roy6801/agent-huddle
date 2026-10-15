import { MinutesSettings, type Field } from "@/components/minutes-settings";
import { useRoom } from "@/hooks/use-room";
import type { Headless } from "@/lib/types";

const FIELDS: Field<keyof Headless>[] = [
  { key: "wakesPerHour", label: "Wakes per hour", unit: "wakes/h", min: 1, max: 120 },
  { key: "runMinutes", label: "Longest run", unit: "min/run", min: 1, max: 120 },
  { key: "idleMinutes", label: "Stop after idle", unit: "min idle", min: 5, max: 1440 },
];

/** Limits the headless workers keep: wakes per hour, minutes per run and idle minutes before they leave. */
export function HeadlessBudgets() {
  const { headless } = useRoom().state;
  return (
    <MinutesSettings
      id="headless"
      title="Headless agents"
      noun="headless budgets"
      fields={FIELDS}
      values={headless}
      summary={(h) => `${h.wakesPerHour} wakes/h · ${h.runMinutes} min/run · stop after ${h.idleMinutes} min idle`}
    />
  );
}
