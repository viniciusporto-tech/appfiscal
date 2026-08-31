import { notFound } from "next/navigation";
import Link from "next/link";
import { InfractionForm } from "@/components/admin/InfractionForm";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("infraction_types").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div><div className="eyebrow">Infrações</div><h1 className="page-title">Editar infração</h1></div>
        <Link className="button button-secondary" href="/admin/infracoes">Voltar</Link>
      </div>
      <InfractionForm
        initial={{
          id: data.id,
          code: data.code ?? "",
          name: data.name,
          category: data.category,
          description: data.description ?? "",
          legalBasis: data.legal_basis ?? "",
          severity: data.severity ?? "normal",
          active: data.active,
          allowedVehicleTypes: data.allowed_vehicle_types ?? [],
        }}
      />
    </section>
  );
}
