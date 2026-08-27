// Dados demonstrativos usados apenas enquanto os indicadores reais não estão conectados.
const teamMetrics = [
  { team: "A", inspections: 0, agents: 0 },
  { team: "Bravo", inspections: 0, agents: 0 },
  { team: "Coruja", inspections: 0, agents: 0 },
  { team: "Delta", inspections: 0, agents: 0 },
];

// Dashboard administrativo inicial.
export default function AdminDashboardPage() {
  return (
    <section id="dashboard">
      <div className="topbar">
        <div>
          <div className="metric-label">Administração</div>
          <h1 style={{ margin: "4px 0" }}>Dashboard</h1>
        </div>
        <div className="metric-label">Período: mês atual</div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="metric-label">Fiscalizações</div>
          <div className="metric-value">0</div>
        </div>
        <div className="card">
          <div className="metric-label">Notificações</div>
          <div className="metric-value">0</div>
        </div>
        <div className="card">
          <div className="metric-label">Veículos fiscalizados</div>
          <div className="metric-value">0</div>
        </div>
        <div className="card">
          <div className="metric-label">Reincidentes</div>
          <div className="metric-value">0</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card" id="equipes">
          <h2>Atuação por equipe</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipe</th>
                  <th>Fiscalizações</th>
                  <th>Agentes em serviço</th>
                </tr>
              </thead>
              <tbody>
                {teamMetrics.map((item) => (
                  <tr key={item.team}>
                    <td>{item.team}</td>
                    <td>{item.inspections}</td>
                    <td>{item.agents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" id="mapa">
          <h2>Mapa de fiscalizações</h2>
          <p className="metric-label">
            O mapa será conectado ao MapLibre/OpenStreetMap na próxima etapa.
          </p>
        </div>
      </div>
    </section>
  );
}
