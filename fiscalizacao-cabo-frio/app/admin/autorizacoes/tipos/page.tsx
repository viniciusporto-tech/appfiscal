import Link from "next/link";
import { ServiceTypeManager } from "@/components/admin/ServiceTypeManager";
import { createClient } from "@/lib/supabase/server";

export default async function ServiceTypesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_types").select("id,name,description,active").order("name");

  return (
    <section>
      <div className="topbar">
        <div><div className="eyebrow">Autorizações</div><h1 className="page-title">Tipos de serviço</h1><p className="page-subtitle">Cadastre os serviços usados nas autorizações, como turismo, fretamento, escolar, evento ou outros.</p></div>
        <Link className="button button-secondary" href="/admin/autorizacoes">Voltar</Link>
      </div>
      {error && <div className="notice notice-error">Falha ao carregar: {error.message}. Execute a migration 009_authorized_vehicles.sql.</div>}
      <ServiceTypeManager initial={data ?? []} />
    </section>
  );
}
