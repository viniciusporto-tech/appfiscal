import Link from "next/link"; import { TeamForm } from "@/components/admin/TeamForm";
export default function Page(){ return <section className="admin-form-page"><div className="topbar"><div><div className="eyebrow">Equipes</div><h1 className="page-title">Nova equipe</h1></div><Link className="button button-secondary" href="/admin/equipes">Voltar</Link></div><TeamForm /></section>; }
