export type ShiftPeriod = "day" | "night" | "full";

export const SHIFT_PERIOD_OPTIONS: ReadonlyArray<{
  value: ShiftPeriod;
  label: string;
  hours: 12 | 24;
}> = [
  {
    value: "day",
    label: "Diurno — 07h às 19h",
    hours: 12,
  },
  {
    value: "night",
    label: "Noturno — 19h às 07h",
    hours: 12,
  },
  {
    value: "full",
    label: "Plantão 24h — 07h às 07h",
    hours: 24,
  },
];

const OFFSET = "-03:00";

export function addDays(dateText: string, days: number) {
  const [year, month, day] = dateText.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function getShiftInterval(serviceDate: string) {
  return {
    startsAt: `${serviceDate}T07:00:00${OFFSET}`,
    endsAt: `${addDays(serviceDate, 1)}T07:00:00${OFFSET}`,
  };
}

export function getAssignmentInterval(
  serviceDate: string,
  period: ShiftPeriod,
) {
  if (period === "day") {
    return {
      startsAt: `${serviceDate}T07:00:00${OFFSET}`,
      endsAt: `${serviceDate}T19:00:00${OFFSET}`,
    };
  }

  if (period === "night") {
    return {
      startsAt: `${serviceDate}T19:00:00${OFFSET}`,
      endsAt: `${addDays(serviceDate, 1)}T07:00:00${OFFSET}`,
    };
  }

  return getShiftInterval(serviceDate);
}

export function formatServiceDate(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startsAt));

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}