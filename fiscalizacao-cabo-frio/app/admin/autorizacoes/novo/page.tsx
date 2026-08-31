import Link from "next/link";
import { AuthorizedVehicleForm } from "@/components/admin/AuthorizedVehicleForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewAuthorizationPage() {
  const supabase = await createClient();
  const { data: serviceTypes } = await supabase.from("service_types").select("id,name,active").order("name");

  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div><div className="eyebrow">Veículos autorizados</div><h1 className="page-title">Nova autorização</h1><p className="page-subtitle">Cadastre veículo, empresa, tipo de serviço, validade, horário e área permitida.</p></div>
        <Link className="button button-secondary" href="/admin/autorizacoes">Voltar</Link>
      </div>
      {(serviceTypes?.length ?? 0) === 0 && <div className="notice notice-warning">Cadastre pelo menos um tipo de serviço antes de criar uma autorização. <Link className="table-action" href="/admin/autorizacoes/tipos">Cadastrar tipo agora</Link>.</div>}
      <AuthorizedVehicleForm serviceTypes={serviceTypes ?? []} />
    </section>
  );
}
