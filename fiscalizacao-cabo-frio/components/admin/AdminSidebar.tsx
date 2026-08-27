import Link from "next/link";

// Menu lateral reutilizado em todas as telas administrativas.
export function AdminSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>Fiscalização</strong>
        <span>Cabo Frio</span>
      </div>

      <nav aria-label="Menu administrativo">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin#fiscalizacoes">Fiscalizações</Link>
        <Link href="/admin#veiculos">Veículos</Link>
        <Link href="/admin#equipes">Equipes</Link>
        <Link href="/admin/agentes">Agentes</Link>
        <Link href="/admin/escalas">Escalas / Plantões</Link>
        <Link href="/admin#mapa">Mapa</Link>
        <Link href="/admin#relatorios">Relatórios</Link>
        <Link href="/admin#auditoria">Auditoria</Link>
      </nav>
    </aside>
  );
}
