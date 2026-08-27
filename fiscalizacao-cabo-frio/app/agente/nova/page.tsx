"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { getCurrentPosition, type GeoPosition } from "@/lib/geo";
import { savePendingInspection } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";

// O prazo de retenção NÃO é definido no celular.
// Ele fica centralizado no banco para o agente não conseguir alterar a política de retenção.

// Formulário principal usado pelo agente durante a fiscalização.
export default function NewInspectionPage() {
  // Placa informada pelo agente.
  const [plate, setPlate] = useState("");

  // Tipo do veículo observado.
  const [vehicleType, setVehicleType] = useState("automovel");

  // Identificador da infração escolhida no cadastro do Supabase.
  const [infractionTypeId, setInfractionTypeId] = useState("");

  // Campo livre para detalhes complementares.
  const [notes, setNotes] = useState("");

  // Foto escolhida/tirada no celular.
  const [photo, setPhoto] = useState<File | null>(null);

  // Localização obtida pelo GPS.
  const [position, setPosition] = useState<GeoPosition | null>(null);

  // Mensagem de estado mostrada ao agente.
  const [message, setMessage] = useState("");

  // Evita dois envios simultâneos.
  const [saving, setSaving] = useState(false);

  // Normaliza a placa para letras maiúsculas e remove caracteres que não sejam letras/números.
  function normalizePlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }

  // Executa a captura do GPS quando o agente toca no botão correspondente.
  async function handleLocation() {
    setMessage("Obtendo localização...");

    try {
      const currentPosition = await getCurrentPosition();
      setPosition(currentPosition);
      setMessage("Localização capturada com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível obter o GPS.");
    }
  }

  // Guarda a primeira foto selecionada no campo de câmera/arquivo.
  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setPhoto(selectedFile);
  }

  // Salva a fiscalização no Supabase; em caso de falha de conexão, guarda no IndexedDB.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    // Monta o objeto comum que será enviado online ou guardado offline.
    const payload = {
      plate: normalizePlate(plate),
      vehicle_type: vehicleType,
      infraction_type_id: infractionTypeId || null,
      notes,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      gps_accuracy: position?.accuracy ?? null,
      captured_at: new Date().toISOString(),
    };

    try {
      // Se o navegador estiver offline, pula diretamente para o armazenamento local.
      if (!navigator.onLine) throw new Error("offline");

      const supabase = createClient();

      // Obtém o usuário autenticado para vincular a fiscalização ao agente correto.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sessão inválida. Faça login novamente.");

      // Consulta a escala ativa do agente no horário atual.
      const now = new Date().toISOString();
      const { data: activeShift, error: shiftError } = await supabase
        .from("shift_agents")
        .select("shift_id, team_id")
        .eq("agent_id", userData.user.id)
        .eq("status", "scheduled")
        .lte("starts_at", now)
        .gte("ends_at", now)
        .limit(1)
        .maybeSingle();

      if (shiftError) throw shiftError;
      if (!activeShift) throw new Error("Nenhuma escala ativa foi encontrada para este agente.");

      // Insere o registro textual da fiscalização antes de enviar a foto.
      const { data: inspection, error: inspectionError } = await supabase
        .from("inspections")
        .insert({
          ...payload,
          agent_id: userData.user.id,
          team_id: activeShift.team_id,
          shift_id: activeShift.shift_id,
        })
        .select("id, occurrence_number")
        .single();

      if (inspectionError) throw inspectionError;

      // Faz upload da foto somente se o agente realmente anexou uma imagem.
      if (photo) {
        // Usa um caminho único para não sobrescrever fotos de outras fiscalizações.
        const fileExtension = photo.name.split(".").pop() || "jpg";
        const filePath = `${inspection.id}/${crypto.randomUUID()}.${fileExtension}`;

        // Envia o arquivo para o bucket privado "inspection-photos".
        const { error: uploadError } = await supabase.storage.from("inspection-photos").upload(filePath, photo, {
          upsert: false,
          contentType: photo.type || "image/jpeg",
        });

        if (uploadError) throw uploadError;

        // Registra apenas o caminho da foto.
        // O próprio banco calcula expires_at usando a política administrativa de retenção.
        const { error: photoRecordError } = await supabase.from("inspection_photos").insert({
          inspection_id: inspection.id,
          storage_path: filePath,
          preserved: false,
        });

        if (photoRecordError) throw photoRecordError;
      }

      // Confirma o sucesso usando o número oficial criado no banco.
      setMessage(`Fiscalização ${inspection.occurrence_number} registrada com sucesso.`);

      // Limpa os campos básicos para permitir nova fiscalização.
      setPlate("");
      setNotes("");
      setPhoto(null);
    } catch (error) {
      // Identifica falha de rede e guarda o registro localmente para não perder trabalho de campo.
      const networkProblem = !navigator.onLine || (error instanceof Error && error.message === "offline");

      if (networkProblem) {
        await savePendingInspection({
          localId: crypto.randomUUID(),
          // O IndexedDB consegue armazenar o objeto File/Blob junto com os demais dados.
          // Isso evita perder a foto quando a fiscalização é feita sem internet.
          payload: { ...payload, photo },
          createdAt: new Date().toISOString(),
        });

        setMessage("Sem internet: fiscalização salva neste aparelho para sincronização posterior.");
      } else {
        setMessage(error instanceof Error ? error.message : "Não foi possível registrar a fiscalização.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <header className="topbar">
        <div>
          <div className="metric-label">Área do agente</div>
          <h1 style={{ margin: "4px 0" }}>Nova fiscalização</h1>
        </div>
        <Link className="button button-secondary" href="/agente">Voltar</Link>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label" htmlFor="plate">Placa</label>
          <input
            className="input"
            id="plate"
            value={plate}
            onChange={(event) => setPlate(normalizePlate(event.target.value))}
            placeholder="ABC1D23"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="vehicleType">Tipo de veículo</label>
          <select className="select" id="vehicleType" value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
            <option value="automovel">Automóvel</option>
            <option value="onibus">Ônibus</option>
            <option value="van">Van</option>
            <option value="taxi">Táxi</option>
            <option value="moto">Moto</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="infraction">Tipo de infração (ID temporário)</label>
          <input
            className="input"
            id="infraction"
            value={infractionTypeId}
            onChange={(event) => setInfractionTypeId(event.target.value)}
            placeholder="Depois será substituído por uma lista carregada do Supabase"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="photo">Foto do veículo</label>
          <input className="input" id="photo" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
          <small className="metric-label">No celular, o navegador tentará abrir a câmera traseira.</small>
        </div>

        <div className="field">
          <label className="label">Localização</label>
          <button className="button button-secondary" type="button" onClick={handleLocation}>Capturar GPS</button>
          {position && (
            <small className="metric-label">
              Lat: {position.latitude.toFixed(6)} | Long: {position.longitude.toFixed(6)} | Precisão: {Math.round(position.accuracy)} m
            </small>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="notes">Observações</label>
          <textarea className="textarea" id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {message && <div className="notice">{message}</div>}

        <button className="button" type="submit" disabled={saving} style={{ width: "100%" }}>
          {saving ? "Salvando..." : "Registrar fiscalização"}
        </button>
      </form>
    </main>
  );
}
