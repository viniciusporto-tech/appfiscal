import Link from "next/link";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Página inicial simplificada para uso do agente na rua.
export default function AgentHomePage() {
  return (
    <main className="page">
      {/* Mantém os recursos de PWA ativos nesta área. */}
      <ServiceWorkerRegister />

      <header className="topbar">
        <div>
          <div className="metric-label">Sistema de Fiscalização</div>
          <h1 style={{ margin: "4px 0" }}>Área do Agente</h1>
          <div className="metric-label">Equipe e plantão serão carregados automaticamente do banco.</div>
        </div>

        <Link className="button" href="/agente/nova">+ Nova fiscalização</Link>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <strong>Plantão atual</strong>
        <p className="metric-label">Após conectar o Supabase, este cartão mostrará equipe, início e fim da escala ativa.</p>
      </section>

      <section className="quick-actions">
        <Link className="quick-action" href="/agente/nova">Nova fiscalização</Link>
        <div className="quick-action">Minhas fiscalizações</div>
        <div className="quick-action">Consultar veículo</div>
        <div className="quick-action">Meu plantão</div>
        <div className="quick-action">Sincronizar dados</div>
        <div className="quick-action">Sair</div>
      </section>
    </main>
  );
}
