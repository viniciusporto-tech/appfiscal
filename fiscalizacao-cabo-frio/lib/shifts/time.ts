// Fuso horário operacional usado pela fiscalização de Cabo Frio.
//
// O banco armazena horários em UTC (timestamptz), mas a escala é montada
// pela data e pelo horário local da operação.
export const OPERATION_TIME_ZONE = "America/Sao_Paulo";

// Para o MVP usamos o deslocamento atual de Cabo Frio/São Paulo.
// O Brasil não usa horário de verão desde 2019.
// Se a legislação mudar no futuro, esta função deverá ser trocada por uma
// biblioteca de timezone (ex.: Temporal/Luxon) para calcular o offset do dia.
const OPERATION_UTC_OFFSET = "-03:00";

// Períodos padronizados disponíveis no formulário de escala.
export type ShiftPeriod = "day" | "night" | "full";

// Informações legíveis de cada período.
export const SHIFT_PERIOD_OPTIONS: Array<{
  value: ShiftPeriod;
  label: string;
  description: string;
  hours: 12 | 24;
}> = [
  {
    value: "day",
    label: "07h às 19h",
    description: "Turno diurno de 12 horas",
    hours: 12,
  },
  {
    value: "night",
    label: "19h às 07h",
    description: "Turno noturno de 12 horas",
    hours: 12,
  },
  {
    value: "full",
    label: "07h às 07h",
    description: "Plantão completo de 24 horas",
    hours: 24,
  },
];

// Soma uma quantidade de dias a uma data no formato YYYY-MM-DD.
// O cálculo usa UTC apenas para evitar mudança inesperada pela timezone do servidor.
export function addDaysToDate(dateText: string, amount: number): string {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

// Converte a data operacional e o período escolhido para timestamps ISO.
// Esses valores são enviados ao Supabase como timestamptz.
export function getAssignmentInterval(
  serviceDate: string,
  period: ShiftPeriod,
): { startsAt: string; endsAt: string } {
  // O plantão inteiro sempre começa às 07h da data selecionada.
  const nextDate = addDaysToDate(serviceDate, 1);

  // Agente do turno diurno trabalha de 07h a 19h no mesmo dia.
  if (period === "day") {
    return {
      startsAt: `${serviceDate}T07:00:00${OPERATION_UTC_OFFSET}`,
      endsAt: `${serviceDate}T19:00:00${OPERATION_UTC_OFFSET}`,
    };
  }

  // Agente do turno noturno entra às 19h e sai às 07h do dia seguinte.
  if (period === "night") {
    return {
      startsAt: `${serviceDate}T19:00:00${OPERATION_UTC_OFFSET}`,
      endsAt: `${nextDate}T07:00:00${OPERATION_UTC_OFFSET}`,
    };
  }

  // Agente de 24h permanece por todo o plantão.
  return {
    startsAt: `${serviceDate}T07:00:00${OPERATION_UTC_OFFSET}`,
    endsAt: `${nextDate}T07:00:00${OPERATION_UTC_OFFSET}`,
  };
}

// Retorna o intervalo completo do plantão de 24 horas.
export function getShiftInterval(serviceDate: string): {
  startsAt: string;
  endsAt: string;
} {
  return getAssignmentInterval(serviceDate, "full");
}

// Formata um timestamptz do banco para o padrão brasileiro no fuso de Cabo Frio.
export function formatOperationalDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: OPERATION_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

// Formata somente a data operacional de um plantão.
export function formatOperationalDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: OPERATION_TIME_ZONE,
    dateStyle: "short",
  }).format(new Date(value));
}

// Descobre qual dos três períodos padronizados corresponde a um vínculo salvo.
export function inferShiftPeriod(startsAt: string, endsAt: string): ShiftPeriod {
  // Calcula a duração total em horas.
  const durationHours =
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) /
    (1000 * 60 * 60);

  // Um vínculo de aproximadamente 24h representa o plantão completo.
  if (durationHours >= 23) {
    return "full";
  }

  // Descobre a hora local de início para diferenciar diurno e noturno.
  const hourText = new Intl.DateTimeFormat("pt-BR", {
    timeZone: OPERATION_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(startsAt));

  const startHour = Number(hourText);
  return startHour >= 18 ? "night" : "day";
}
