"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Camera, LocateFixed, MapPin, Save } from "lucide-react";
import { compressInspectionPhoto } from "@/lib/images/compress";
import { uploadInspection } from "@/lib/inspections/client";
import type { EnforcementAction } from "@/lib/inspections/labels";
import { savePendingInspection } from "@/lib/offline";
import { normalizePlate } from "@/lib/utils/format";

type Infraction = {
  id: string;
  name: string;
  category: string;
  allowed_vehicle_types: string[] | null;
};

type Position = { latitude: number; longitude: number; accuracy: number };

const VEHICLE_TYPES = ["Carro", "Ônibus", "Van", "Táxi", "Moto", "Micro-ônibus", "Outro"];

export function NewInspectionForm({ infractions }: { infractions: Infraction[] }) {
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState("Carro");
  const [infractionId, setInfractionId] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoInfo, setPhotoInfo] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [enforcementAction, setEnforcementAction] = useState<EnforcementAction>("none");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const visibleInfractions = useMemo(
    () =>
      infractions.filter((item) => {
        const allowed = item.allowed_vehicle_types ?? [];
        return allowed.length === 0 || allowed.includes(vehicleType);
      }),
    [infractions, vehicleType],
  );

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setPhoto(null);
      setPhotoInfo("");
      return;
    }

    setPhotoInfo("Otimizando foto...");
    const optimized = await compressInspectionPhoto(selected);
    setPhoto(optimized);
    setPhotoInfo(
      `Foto pronta: ${(optimized.size / 1024).toFixed(0)} KB${optimized.size < selected.size ? ` (era ${(selected.size / 1024).toFixed(0)} KB)` : ""}.`,
    );
  }

  function changeVehicleType(nextType: string) {
    setVehicleType(nextType);
    const selected = infractions.find((item) => item.id === infractionId);
    if (selected) {
      const allowed = selected.allowed_vehicle_types ?? [];
      if (allowed.length > 0 && !allowed.includes(nextType)) setInfractionId("");
    }
  }

  async function resolveAddress(latitude: number, longitude: number) {
    setAddressLoading(true);
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`, {
        credentials: "include",
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Não foi possível localizar o endereço.");
      setAddress(data.address ?? data.displayName ?? "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message} As coordenadas foram mantidas.`
          : "Não foi possível localizar o endereço.",
      );
    } finally {
      setAddressLoading(false);
    }
  }

  function getGps() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Este aparelho não disponibiliza geolocalização.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (result) => {
        const nextPosition = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };
        setPosition(nextPosition);
        await resolveAddress(nextPosition.latitude, nextPosition.longitude);
      },
      (error) => setMessage(`Não foi possível obter o GPS: ${error.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const normalizedPlate = normalizePlate(plate);
    if (normalizedPlate.length !== 7) {
      setMessage("Informe uma placa válida com 7 caracteres.");
      setSaving(false);
      return;
    }

    const payload = {
      plate: normalizedPlate,
      vehicleType,
      infractionId: infractionId || null,
      notes,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      gpsAccuracy: position?.accuracy ?? null,
      address: address.trim() || null,
      enforcementAction,
      capturedAt: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      const result = await uploadInspection(payload, photo, photo?.name, photo?.type);
      setMessage(`Fiscalização ${result.occurrence_number} registrada com sucesso.`);
      setPlate("");
      setNotes("");
      setPhoto(null);
      setPhotoInfo("");
      setPosition(null);
      setAddress("");
      setInfractionId("");
      setEnforcementAction("none");
    } catch (error) {
      if (!navigator.onLine || (error instanceof Error && error.message === "OFFLINE")) {
        await savePendingInspection({
          localId: crypto.randomUUID(),
          payload,
          photo,
          photoName: photo?.name ?? null,
          photoType: photo?.type ?? null,
          createdAt: new Date().toISOString(),
        });
        setMessage(
          "Sem internet: fiscalização salva neste aparelho. Use 'Sincronizar dados' quando a conexão voltar.",
        );
      } else {
        setMessage(error instanceof Error ? error.message : "Falha ao registrar fiscalização.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="field">
        <label className="label">Foto do veículo</label>
        <input
          className="input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
        />
        <span className="field-help">
          <Camera size={13} style={{ verticalAlign: "middle" }} /> A foto é comprimida antes do envio para reduzir consumo de armazenamento e internet.
        </span>
        {photoInfo ? <span className="field-help">{photoInfo}</span> : null}
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label">Placa</label>
          <input
            className="input"
            value={plate}
            onChange={(e) => setPlate(normalizePlate(e.target.value))}
            placeholder="ABC1D23"
            maxLength={7}
            required
          />
        </div>
        <div className="field">
          <label className="label">Tipo de veículo</label>
          <select className="select" value={vehicleType} onChange={(e) => changeVehicleType(e.target.value)}>
            {VEHICLE_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Infração / notificação</label>
        <select className="select" value={infractionId} onChange={(e) => setInfractionId(e.target.value)}>
          <option value="">Sem infração cadastrada / somente fiscalização</option>
          {visibleInfractions.map((item) => (
            <option key={item.id} value={item.id}>{item.category} — {item.name}</option>
          ))}
        </select>
        <span className="field-help">
          Mostrando somente infrações válidas para {vehicleType}. Infrações configuradas para todos também aparecem.
        </span>
      </div>

      <div className="field">
        <label className="label">Resultado da abordagem</label>
        <select
          className="select"
          value={enforcementAction}
          onChange={(e) => setEnforcementAction(e.target.value as EnforcementAction)}
        >
          <option value="none">Não foi multado</option>
          <option value="municipal_guard">Multado pela Guarda</option>
          <option value="transport_inspector">Multado pelo Fiscal</option>
        </select>
      </div>

      <div className="field">
        <label className="label">Localização</label>
        <button type="button" className="button button-secondary" onClick={getGps} disabled={addressLoading}>
          <LocateFixed size={18} /> {addressLoading ? "Localizando endereço..." : "Capturar GPS e endereço"}
        </button>
        {position && (
          <span className="field-help">
            {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)} • precisão ±{Math.round(position.accuracy)} m
          </span>
        )}
      </div>

      <div className="field">
        <label className="label">
          <MapPin size={14} style={{ verticalAlign: "middle" }} /> Endereço da ocorrência
        </label>
        <input
          className="input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, número, bairro, cidade..."
        />
      </div>

      <div className="field">
        <label className="label">Observações</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Descreva o que foi constatado..."
        />
      </div>

      {message && <div className={message.includes("sucesso") ? "notice notice-success" : "notice"}>{message}</div>}

      <div className="form-actions">
        <Link className="button button-secondary" href="/agente">Voltar</Link>
        <button className="button button-success" disabled={saving}>
          <Save size={18} /> {saving ? "Salvando..." : "Registrar fiscalização"}
        </button>
      </div>
    </form>
  );
}
