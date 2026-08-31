export type ShiftPeriod = "day" | "night" | "full";
const OFFSET = "-03:00";

export function addDays(dateText: string, days: number) {
  const [y,m,d] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(y,m-1,d));
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

export function getShiftInterval(serviceDate: string) {
  return { startsAt: `${serviceDate}T07:00:00${OFFSET}`, endsAt: `${addDays(serviceDate,1)}T07:00:00${OFFSET}` };
}

export function getAssignmentInterval(serviceDate: string, period: ShiftPeriod) {
  if (period === "day") return { startsAt: `${serviceDate}T07:00:00${OFFSET}`, endsAt: `${serviceDate}T19:00:00${OFFSET}` };
  if (period === "night") return { startsAt: `${serviceDate}T19:00:00${OFFSET}`, endsAt: `${addDays(serviceDate,1)}T07:00:00${OFFSET}` };
  return getShiftInterval(serviceDate);
}

export function formatServiceDate(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date(startsAt));
  const values = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
