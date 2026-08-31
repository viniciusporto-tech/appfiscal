import { createClient } from "@/lib/supabase/server";

export default async function AgentDecreesPage() {
  const supabase = await createClient();
  const { data: decrees, error } = await supabase
    .from("decrees")
    .select("id,name,storage_path")
    .eq("active", true)
    .order("name", { ascending: true });

  const items = await Promise.all(
    (decrees ?? []).map(async (decree) => {
      const { data } = await supabase.storage.from("decrees").createSignedUrl(decree.storage_path, 60 * 60);
      return { id: decree.id, name: decree.name, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="agent-page">
      <div className="agent-container">
        <header className="topbar">
          <div>
            <div className="eyebrow">Consulta rápida</div>
            <h1 className="page-title">Decretos</h1>
            <p className="page-subtitle">Abra os PDFs disponibilizados pela administração.</p>
          </div>
        </header>

        {error ? <div className="notice notice-error">Não foi possível carregar os decretos.</div> : null}
        {!error && items.length === 0 ? <section className="card empty-state">Nenhum decreto disponível.</section> : null}

        <section className="decree-list">
          {items.map((decree) => (
            <div className="card decree-card" key={decree.id}>
              <div className="decree-card-icon" aria-hidden="true">PDF</div>
              <div className="decree-card-body"><strong>{decree.name}</strong><span className="field-help">Documento oficial em PDF</span></div>
              {decree.url ? <a className="button" href={decree.url} target="_blank" rel="noreferrer">Abrir PDF</a> : <span className="field-help">Indisponível</span>}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
