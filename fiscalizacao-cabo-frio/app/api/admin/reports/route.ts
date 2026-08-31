import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { enforcementLabel, isFined } from "@/lib/inspections/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils/format";

type ReportType = "inspections" | "vehicles";
type ReportRow = Record<string, unknown>;
type ColumnDef = { label: string; width?: number };

const INSPECTION_COLUMNS: Record<string, ColumnDef> = {
  occurrence: { label: "Número da ocorrência", width: 20 },
  captured_at: { label: "Data / hora", width: 20 },
  plate: { label: "Placa", width: 13 },
  vehicle_type: { label: "Tipo do veículo", width: 18 },
  brand_model: { label: "Marca / modelo", width: 25 },
  color: { label: "Cor", width: 15 },
  company_name: { label: "Empresa / operador", width: 28 },
  fleet_prefix: { label: "Prefixo", width: 14 },
  route_name: { label: "Linha", width: 20 },
  infraction: { label: "Infração", width: 35 },
  infraction_code: { label: "Código da infração", width: 18 },
  infraction_category: { label: "Categoria da infração", width: 22 },
  enforcement: { label: "Resultado / multa", width: 24 },
  team: { label: "Equipe", width: 20 },
  agent: { label: "Agente", width: 28 },
  registration: { label: "Matrícula do agente", width: 18 },
  address: { label: "Endereço", width: 50 },
  latitude: { label: "Latitude", width: 16 },
  longitude: { label: "Longitude", width: 16 },
  gps_accuracy: { label: "Precisão do GPS (m)", width: 18 },
  notes: { label: "Observações", width: 45 },
  photo_count: { label: "Quantidade de fotos", width: 18 },
  record_status: { label: "Situação do registro", width: 18 },
  created_at: { label: "Data de gravação no sistema", width: 22 },
};

const VEHICLE_COLUMNS: Record<string, ColumnDef> = {
  plate: { label: "Placa", width: 13 },
  vehicle_type: { label: "Tipo do veículo", width: 18 },
  brand_model: { label: "Marca / modelo", width: 25 },
  color: { label: "Cor", width: 15 },
  company_name: { label: "Empresa / operador", width: 28 },
  fleet_prefix: { label: "Prefixo", width: 14 },
  route_name: { label: "Linha", width: 20 },
  active: { label: "Status do cadastro", width: 18 },
  first_seen_at: { label: "Primeira fiscalização", width: 20 },
  last_seen_at: { label: "Última fiscalização cadastrada", width: 24 },
  inspection_count: { label: "Fiscalizações no período", width: 21 },
  infraction_count: { label: "Infrações no período", width: 19 },
  fine_count: { label: "Multas no período", width: 17 },
  last_inspection_at: { label: "Última fiscalização no período", width: 24 },
  last_infraction: { label: "Última infração no período", width: 35 },
  authorization_count: { label: "Autorizações cadastradas", width: 22 },
  valid_authorization_count: { label: "Autorizações válidas", width: 20 },
  authorization_status: { label: "Situação das autorizações", width: 24 },
  service_types: { label: "Tipos de serviço autorizados", width: 35 },
  notes: { label: "Observações do veículo", width: 45 },
};

const DEFAULT_INSPECTION_FIELDS = ["occurrence", "captured_at", "plate", "vehicle_type", "infraction", "enforcement", "team", "agent", "address"];
const DEFAULT_VEHICLE_FIELDS = ["plate", "vehicle_type", "company_name", "fleet_prefix", "inspection_count", "infraction_count", "fine_count", "last_inspection_at"];

function parseDate(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback.toISOString().slice(0, 10);
  return value;
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function dateRange(url: URL) {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const from = parseDate(url.searchParams.get("dateFrom"), monthAgo);
  const to = parseDate(url.searchParams.get("dateTo"), today);
  const all = url.searchParams.get("allDates") === "1";
  return {
    all,
    from,
    to,
    start: `${from}T00:00:00-03:00`,
    end: `${nextDate(to)}T00:00:00-03:00`,
  };
}

function selectedFields(url: URL, type: ReportType) {
  const columns = type === "inspections" ? INSPECTION_COLUMNS : VEHICLE_COLUMNS;
  const defaults = type === "inspections" ? DEFAULT_INSPECTION_FIELDS : DEFAULT_VEHICLE_FIELDS;
  const requested = (url.searchParams.get("fields") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const valid = requested.filter((field) => Boolean(columns[field]));
  return valid.length ? Array.from(new Set(valid)) : defaults;
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function pdfSafe(value: unknown) {
  return cleanValue(value)
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF\n\r\t]/g, "?");
}

async function loadInspectionRows(url: URL): Promise<ReportRow[]> {
  const admin = createAdminClient();
  const range = dateRange(url);
  const recordStatus = url.searchParams.get("recordStatus") ?? "active";
  const plate = url.searchParams.get("plate")?.trim();
  const vehicleType = url.searchParams.get("vehicleType")?.trim();
  const teamId = url.searchParams.get("teamId")?.trim();
  const agentId = url.searchParams.get("agentId")?.trim();
  const infractionId = url.searchParams.get("infractionId")?.trim();
  const enforcementAction = url.searchParams.get("enforcementAction")?.trim();
  const rawRows: any[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < 50000; offset += pageSize) {
    let query = admin
      .from("inspections")
      .select(`
        id,
        occurrence_number,
        captured_at,
        created_at,
        plate,
        vehicle_type,
        infraction_type_id,
        enforcement_action,
        address,
        latitude,
        longitude,
        gps_accuracy,
        notes,
        status,
        teams(name),
        profiles!inspections_agent_id_fkey(full_name,registration_number),
        infraction_types(name,category,code),
        vehicles(brand_model,color,company_name,fleet_prefix,route_name),
        inspection_photos(id,deleted_at)
      `)
      .order("captured_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (!range.all) query = query.gte("captured_at", range.start).lt("captured_at", range.end);
    if (recordStatus !== "all") query = query.eq("status", recordStatus === "cancelled" ? "cancelled" : "active");
    if (plate) query = query.ilike("plate", `%${plate}%`);
    if (vehicleType) query = query.eq("vehicle_type", vehicleType);
    if (teamId) query = query.eq("team_id", teamId);
    if (agentId) query = query.eq("agent_id", agentId);
    if (infractionId) query = query.eq("infraction_type_id", infractionId);
    if (enforcementAction) query = query.eq("enforcement_action", enforcementAction);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rawRows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return rawRows.map((raw: any) => ({
    occurrence: raw.occurrence_number,
    captured_at: formatDateTime(raw.captured_at),
    plate: raw.plate,
    vehicle_type: raw.vehicle_type,
    brand_model: raw.vehicles?.brand_model,
    color: raw.vehicles?.color,
    company_name: raw.vehicles?.company_name,
    fleet_prefix: raw.vehicles?.fleet_prefix,
    route_name: raw.vehicles?.route_name,
    infraction: raw.infraction_types?.name ?? "Somente fiscalização",
    infraction_code: raw.infraction_types?.code,
    infraction_category: raw.infraction_types?.category,
    enforcement: enforcementLabel(raw.enforcement_action),
    team: raw.teams?.name,
    agent: raw.profiles?.full_name,
    registration: raw.profiles?.registration_number,
    address: raw.address,
    latitude: raw.latitude,
    longitude: raw.longitude,
    gps_accuracy: raw.gps_accuracy,
    notes: raw.notes,
    photo_count: (raw.inspection_photos ?? []).filter((photo: any) => !photo.deleted_at).length,
    record_status: raw.status === "cancelled" ? "Cancelada" : "Ativa",
    created_at: formatDateTime(raw.created_at),
  }));
}

async function loadVehicleRows(url: URL): Promise<ReportRow[]> {
  const admin = createAdminClient();
  const range = dateRange(url);
  const plateFilter = url.searchParams.get("plate")?.trim();
  const vehicleType = url.searchParams.get("vehicleType")?.trim();
  const company = url.searchParams.get("company")?.trim();
  const infractionId = url.searchParams.get("infractionId")?.trim();
  const serviceTypeId = url.searchParams.get("serviceTypeId")?.trim();
  const authorizationFilter = url.searchParams.get("authorization") ?? "all";
  const minInspections = Math.max(0, Number(url.searchParams.get("minInspections") ?? 0) || 0);
  const pageSize = 1000;

  async function fetchVehicles() {
    const rows: any[] = [];
    for (let offset = 0; offset < 20000; offset += pageSize) {
      let query = admin
        .from("vehicles")
        .select("plate,vehicle_type,brand_model,color,company_name,fleet_prefix,route_name,notes,active,first_seen_at,last_seen_at")
        .order("plate")
        .range(offset, offset + pageSize - 1);
      if (plateFilter) query = query.ilike("plate", `%${plateFilter}%`);
      if (vehicleType) query = query.eq("vehicle_type", vehicleType);
      if (company) query = query.ilike("company_name", `%${company}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    return rows;
  }

  async function fetchInspections() {
    const rows: any[] = [];
    for (let offset = 0; offset < 50000; offset += pageSize) {
      let query = admin
        .from("inspections")
        .select("plate,captured_at,infraction_type_id,enforcement_action,infraction_types(name)")
        .eq("status", "active")
        .order("captured_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (!range.all) query = query.gte("captured_at", range.start).lt("captured_at", range.end);
      if (plateFilter) query = query.ilike("plate", `%${plateFilter}%`);
      if (vehicleType) query = query.eq("vehicle_type", vehicleType);
      if (infractionId) query = query.eq("infraction_type_id", infractionId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    return rows;
  }

  async function fetchAuthorizations() {
    const rows: any[] = [];
    for (let offset = 0; offset < 30000; offset += pageSize) {
      let query = admin
        .from("vehicle_authorizations")
        .select("plate,service_type_id,valid_from,valid_until,active,service_types(name)")
        .order("plate")
        .range(offset, offset + pageSize - 1);
      if (plateFilter) query = query.ilike("plate", `%${plateFilter}%`);
      if (serviceTypeId) query = query.eq("service_type_id", serviceTypeId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    return rows;
  }

  const [vehicles, inspectionRows, authorizationRows] = await Promise.all([
    fetchVehicles(), fetchInspections(), fetchAuthorizations(),
  ]);

  const selectedPlates = new Set(vehicles.map((item) => item.plate));
  const inspectionMap = new Map<string, any[]>();
  for (const item of inspectionRows) {
    if (!selectedPlates.has(item.plate)) continue;
    const rows = inspectionMap.get(item.plate) ?? [];
    rows.push(item);
    inspectionMap.set(item.plate, rows);
  }

  const authorizationMap = new Map<string, any[]>();
  for (const item of authorizationRows) {
    if (!selectedPlates.has(item.plate)) continue;
    const rows = authorizationMap.get(item.plate) ?? [];
    rows.push(item);
    authorizationMap.set(item.plate, rows);
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const rows: ReportRow[] = [];

  for (const vehicle of vehicles) {
    const inspections = inspectionMap.get(vehicle.plate) ?? [];
    const authorizations = authorizationMap.get(vehicle.plate) ?? [];
    const validAuthorizations = authorizations.filter(
      (item) => item.active && item.valid_from <= today && item.valid_until >= today,
    );

    if (infractionId && inspections.length === 0) continue;
    if (inspections.length < minInspections) continue;
    if (serviceTypeId && authorizations.length === 0) continue;
    if (authorizationFilter === "authorized" && authorizations.length === 0) continue;
    if (authorizationFilter === "valid" && validAuthorizations.length === 0) continue;
    if (authorizationFilter === "not_authorized" && authorizations.length > 0) continue;

    const infractions = inspections.filter((item) => item.infraction_type_id);
    const fines = inspections.filter((item) => isFined(item.enforcement_action));
    const last = inspections[0];
    const serviceNames = Array.from(new Set(authorizations.map((item) => item.service_types?.name).filter(Boolean)));

    rows.push({
      plate: vehicle.plate,
      vehicle_type: vehicle.vehicle_type,
      brand_model: vehicle.brand_model,
      color: vehicle.color,
      company_name: vehicle.company_name,
      fleet_prefix: vehicle.fleet_prefix,
      route_name: vehicle.route_name,
      active: vehicle.active ? "Ativo" : "Inativo",
      first_seen_at: vehicle.first_seen_at ? formatDateTime(vehicle.first_seen_at) : null,
      last_seen_at: vehicle.last_seen_at ? formatDateTime(vehicle.last_seen_at) : null,
      inspection_count: inspections.length,
      infraction_count: infractions.length,
      fine_count: fines.length,
      last_inspection_at: last?.captured_at ? formatDateTime(last.captured_at) : null,
      last_infraction: inspections.find((item) => item.infraction_type_id)?.infraction_types?.name ?? null,
      authorization_count: authorizations.length,
      valid_authorization_count: validAuthorizations.length,
      authorization_status: validAuthorizations.length > 0 ? "Autorização válida" : authorizations.length > 0 ? "Sem autorização válida no momento" : "Sem autorização cadastrada",
      service_types: serviceNames.join(", "),
      notes: vehicle.notes,
    });
  }

  return rows;
}

async function buildExcel(rows: ReportRow[], fields: string[], columns: Record<string, ColumnDef>, title: string, period: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AppFiscal - Fiscalização Cabo Frio";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [{ width: 30 }, { width: 50 }];
  summary.addRow(["APPFISCAL - FISCALIZAÇÃO CABO FRIO", ""]);
  summary.addRow(["Relatório", title]);
  summary.addRow(["Período", period]);
  summary.addRow(["Registros encontrados", rows.length]);
  summary.addRow(["Colunas selecionadas", fields.map((field) => columns[field].label).join(", ")]);
  summary.getRow(1).font = { bold: true, size: 15 };
  summary.getRow(2).font = { bold: true };

  const sheet = workbook.addWorksheet(title.slice(0, 31));
  sheet.columns = fields.map((field) => ({
    header: columns[field].label,
    key: field,
    width: columns[field].width ?? 20,
  }));
  for (const row of rows) sheet.addRow(Object.fromEntries(fields.map((field) => [field, cleanValue(row[field])])));
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });

  return workbook.xlsx.writeBuffer();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function buildPdf(rows: ReportRow[], fields: string[], columns: Record<string, ColumnDef>, title: string, period: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 40;
  let page!: PDFPage;
  let y = 0;

  function newPage() {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
    page.drawText("APPFISCAL - FISCALIZACAO CABO FRIO", { x: margin, y, size: 14, font: bold, color: rgb(0.04, 0.16, 0.28) });
    y -= 20;
  }

  function ensure(height: number) {
    if (y - height < margin) newPage();
  }

  function line(label: string, value: unknown, size = 8.5) {
    const content = `${pdfSafe(label)}: ${pdfSafe(value)}`;
    const lines = wrapText(content, regular, size, pageSize[0] - margin * 2);
    ensure(lines.length * (size + 3));
    for (const item of lines) {
      page.drawText(item, { x: margin, y, size, font: regular, color: rgb(0.1, 0.14, 0.2) });
      y -= size + 3;
    }
  }

  newPage();
  page.drawText(pdfSafe(title), { x: margin, y, size: 11, font: bold });
  y -= 16;
  line("Periodo", period, 9);
  line("Registros", rows.length, 9);
  line("Campos", fields.map((field) => columns[field].label).join(", "), 8);
  y -= 10;

  for (let index = 0; index < rows.length; index++) {
    ensure(36);
    page.drawText(`Registro ${index + 1}`, { x: margin, y, size: 9, font: bold, color: rgb(0.04, 0.16, 0.28) });
    y -= 13;
    for (const field of fields) line(columns[field].label, rows[index][field]);
    y -= 8;
  }

  return pdf.save();
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const reportType: ReportType = url.searchParams.get("reportType") === "vehicles" ? "vehicles" : "inspections";
    const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
    const fields = selectedFields(url, reportType);
    const columns = reportType === "inspections" ? INSPECTION_COLUMNS : VEHICLE_COLUMNS;
    const range = dateRange(url);
    const title = reportType === "inspections" ? "Fiscalizações" : "Veículos";
    const rows = reportType === "inspections" ? await loadInspectionRows(url) : await loadVehicleRows(url);
    const suffix = range.all ? "todo-historico" : `${safeFilename(range.from)}-a-${safeFilename(range.to)}`;
    const base = `${reportType === "inspections" ? "fiscalizacoes" : "veiculos"}-${suffix}`;
    const period = range.all ? "Todo o histórico" : `${range.from} a ${range.to}`;

    if (format === "xlsx") {
      const buffer = await buildExcel(rows, fields, columns, title, period);
      return new Response(Buffer.from(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${base}.xlsx`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "pdf") {
      const bytes = await buildPdf(rows, fields, columns, title, period);
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${base}.pdf`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const header = fields.map((field) => columns[field].label);
    const lines = [header.map(csvCell).join(";")];
    for (const row of rows) lines.push(fields.map((field) => csvCell(cleanValue(row[field]))).join(";"));
    const csv = `\uFEFF${lines.join("\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${base}.csv`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." },
      { status: 500 },
    );
  }
}
