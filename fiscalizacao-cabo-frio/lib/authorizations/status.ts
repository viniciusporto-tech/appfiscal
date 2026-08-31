export type AuthorizationStatus = "valid" | "outside_hours" | "not_started" | "expired" | "revoked";

export const authorizationStatusLabels: Record<AuthorizationStatus, string> = {
  valid: "Autorização válida",
  outside_hours: "Fora do horário autorizado",
  not_started: "Ainda não iniciou",
  expired: "Autorização expirada",
  revoked: "Autorização revogada",
};

type AuthorizationPeriod = {
  active?: boolean | null;
  valid_from: string;
  valid_until: string;
  permitted_start_time?: string | null;
  permitted_end_time?: string | null;
};

function saoPauloNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

function normalizeTime(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

export function authorizationStatus(row: AuthorizationPeriod): AuthorizationStatus {
  if (row.active === false) return "revoked";

  const now = saoPauloNow();
  const start = normalizeTime(row.permitted_start_time);
  const end = normalizeTime(row.permitted_end_time);

  if (now.date < row.valid_from) return "not_started";
  if (now.date > row.valid_until) return "expired";

  if (now.date === row.valid_from && start && now.time < start) return "not_started";
  if (now.date === row.valid_until && end && now.time > end && (!start || start <= end)) return "expired";

  if (start && end) {
    const inside = start <= end
      ? now.time >= start && now.time <= end
      : now.time >= start || now.time <= end;
    if (!inside) return "outside_hours";
  } else if (start && now.time < start) {
    return "outside_hours";
  } else if (end && now.time > end) {
    return "outside_hours";
  }

  return "valid";
}

export function authorizationBadgeClass(status: AuthorizationStatus) {
  if (status === "valid") return "status-active";
  if (status === "outside_hours" || status === "not_started") return "status-scheduled";
  return "status-inactive";
}
