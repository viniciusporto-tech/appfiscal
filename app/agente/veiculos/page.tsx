import Link from "next/link";
import { BusFront } from "lucide-react";
import { VehicleSearch } from "@/components/agent/VehicleSearch";

export default function VehicleLookupPage() {
  return (
    <main className="agent-page">
      <div className="agent-container">
        <div className="topbar">
          <div>
            <div className="eyebrow">Área do agente</div>
            <h1 className="page-title">Consultar veículo</h1>
            <p className="page-subtitle">Consulte histórico, reincidência, notificações, multas e autorizações de circulação pela placa.</p>
          </div>
          <div className="topbar-actions">
            <Link className="button button-secondary" href="/agente/autorizados"><BusFront size={18} /> Todos autorizados</Link>
            <Link className="button button-secondary" href="/agente">Voltar</Link>
          </div>
        </div>
        <VehicleSearch />
      </div>
    </main>
  );
}
