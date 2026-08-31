import { DecreeDeleteButton } from "@/components/admin/DecreeDeleteButton";
import { DecreeUploadForm } from "@/components/admin/DecreeUploadForm";
import { createAdminClient } from "@/lib/supabase/admin";

// Página administrativa para cadastrar e remover PDFs de decretos.
export default async function AdminDecreesPage() {
  // O layout /admin já validou o usuário; este cliente é usado para listar inclusive itens inativos.
  const adminSupabase = createAdminClient();

  const { data: decrees, error } = await adminSupabase
    .from("decrees")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  return (
    <div className="admin-form-page">
      <header className="topbar">
        <div>
          <div className="metric-label">DOCUMENTOS</div>
          <h1 style={{ margin: "4px 0" }}>Decretos</h1>
          <div className="metric-label">
            Envie PDFs que ficarão disponíveis na área dos agentes.
          </div>
        </div>
      </header>

      <DecreeUploadForm />

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-heading">
          <strong>PDFs cadastrados</strong>
          <span className="metric-label">{decrees?.length ?? 0} documento(s)</span>
        </div>

        {error ? (
          <div className="notice notice-error" style={{ marginTop: 16 }}>
            Não foi possível carregar os decretos: {error.message}
          </div>
        ) : null}

        {!error && (decrees?.length ?? 0) === 0 ? (
          <div className="empty-state">Nenhum decreto cadastrado ainda.</div>
        ) : null}

        {(decrees?.length ?? 0) > 0 ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Cadastrado em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {decrees?.map((decree) => (
                  <tr key={decree.id}>
                    <td><strong>{decree.name}</strong></td>
                    <td>
                      <span className={`status-badge ${decree.active ? "status-active" : "status-inactive"}`}>
                        {decree.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>{new Date(decree.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <DecreeDeleteButton id={decree.id} name={decree.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
