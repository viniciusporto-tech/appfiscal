import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BusFront,
  CalendarDays,
  Car,
  FileText,
  BookOpen,
  Gauge,
  Map,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";

// Menu lateral com páginas reais. Nenhum item aponta para âncoras do dashboard.
export function AdminSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-mark">CF</div>
        <div>
          <strong>Fiscalização</strong>
          <span>Painel Administrativo</span>
        </div>
      </div>

      <nav aria-label="Menu administrativo">
        <div className="sidebar-section">Visão geral</div>
        <Link href="/admin"><Gauge size={18} /> Dashboard</Link>
        <Link href="/admin/fiscalizacoes"><Activity size={18} /> Fiscalizações</Link>
        <Link href="/admin/veiculos"><Car size={18} /> Veículos</Link>
        <Link href="/admin/autorizacoes"><BusFront size={18} /> Veículos autorizados</Link>
        <Link href="/admin/mapa"><Map size={18} /> Mapa</Link>

        <div className="sidebar-section">Operação</div>
        <Link href="/admin/equipes"><UsersRound size={18} /> Equipes</Link>
        <Link href="/admin/agentes"><Users size={18} /> Agentes</Link>
        <Link href="/admin/escalas"><CalendarDays size={18} /> Escalas / Plantões</Link>
        <Link href="/admin/infracoes"><AlertTriangle size={18} /> Infrações</Link>
        <Link href="/admin/decretos"><BookOpen size={18} /> Decretos</Link>

        <div className="sidebar-section">Gestão</div>
        <Link href="/admin/relatorios"><FileText size={18} /> Relatórios</Link>
        <Link href="/admin/auditoria"><ShieldCheck size={18} /> Auditoria</Link>
        <Link href="/admin/configuracoes"><Settings size={18} /> Configurações</Link>
        <Link href="/admin/relatorios"><BarChart3 size={18} /> Indicadores</Link>
      </nav>
    </aside>
  );
}
