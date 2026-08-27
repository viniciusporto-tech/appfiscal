# Sistema de Fiscalização — Cabo Frio

MVP inicial de um sistema interno em **PWA** (abre no navegador e pode ser adicionado à tela inicial), sem necessidade de publicação na App Store ou Play Store.

## 1. Tecnologias escolhidas

- **Next.js 16.3.3 + React 19.2.8**: interface web/PWA.
- **TypeScript**: ajuda a evitar erros de tipos e deixa o código mais fácil de manter.
- **Supabase Auth**: login de agentes e administradores.
- **Supabase PostgreSQL**: banco de dados principal.
- **Supabase Storage**: armazenamento privado das fotos.
- **IndexedDB**: fila local de fiscalizações quando estiver sem internet.
- **Service Worker**: cache básico da PWA.
- **MapLibre + OpenStreetMap**: planejado para a etapa do mapa administrativo.
- **Netlify ou Vercel**: hospedagem do site/PWA.
- **GitHub**: versionamento do código.

## 2. Estrutura de pastas

```text
app/
  login/               -> tela de login
  agente/              -> início do agente
    nova/               -> formulário de nova fiscalização
  admin/               -> dashboard administrativo
components/             -> componentes reutilizáveis
lib/
  geo.ts                -> captura de GPS
  offline.ts            -> armazenamento local quando estiver offline
  supabase/client.ts    -> conexão do navegador com Supabase
  supabase/server.ts    -> conexão segura das páginas executadas no servidor
  supabase/proxy.ts     -> renovação/validação da sessão
proxy.ts                -> protege /agente e /admin antes da renderização
public/
  manifest.webmanifest  -> configuração de instalação da PWA
  sw.js                 -> Service Worker / cache
supabase/
  001_schema.sql        -> tabelas, índices, funções e triggers
  002_security.sql      -> políticas RLS
  003_storage.sql       -> políticas do bucket de fotos
  004_photo_retention.sql -> seleção das fotos vencidas
  005_shift_management.sql -> cancelamento/histórico das escalas
```

## 3. Regra das equipes e escalas

O agente **não fica preso a uma única equipe**.

O sistema grava a equipe da ocorrência usando a tabela `shift_agents`, que possui:

- agente;
- plantão;
- equipe;
- horário de entrada;
- horário de saída.

Assim, um agente de 12 horas pode trabalhar em duas equipes diferentes sem bagunçar o histórico.

## 4. Plantão de 24 horas

A tabela `shifts` representa o plantão da equipe, por exemplo:

- início: 27/08/2026 às 07:00;
- fim: 28/08/2026 às 07:00.

A tabela `shift_agents` informa quanto tempo cada agente trabalhou dentro desse plantão.

## 5. Retenção das fotos

O prazo fica centralizado na tabela `system_settings` do Supabase. O agente não controla esse valor pelo celular.

A configuração inicial é **60 dias**. O administrador poderá alterar depois para:

- `30` = apagar após 30 dias;
- `60` = apagar após 60 dias;
- `90` = apagar após 90 dias;
- `NULL` = não apagar automaticamente.

O trigger `trg_set_photo_expiration` calcula `expires_at` no servidor no momento em que a foto é cadastrada.

**Observação importante:** a aplicação ainda precisa da Edge Function da próxima etapa para apagar fisicamente os arquivos do Storage. O banco já está preparado para isso.

## 6. Como configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra o **SQL Editor**.
3. Execute, na ordem:
   - `supabase/001_schema.sql`
   - `supabase/002_security.sql`
   - `supabase/003_storage.sql` (depois de criar o bucket)
   - `supabase/004_photo_retention.sql`
   - `supabase/005_shift_management.sql`
4. Em **Storage**, crie um bucket chamado `inspection-photos` e mantenha-o **privado**.

> Se você já executou os arquivos `001` a `004` em uma versão anterior do projeto, **não precisa refazer o banco**. Execute apenas `supabase/005_shift_management.sql` para adicionar o módulo de escalas.
5. Crie manualmente apenas o **primeiro administrador** em Authentication e `profiles`.
6. Depois que o painel estiver funcionando, os agentes são cadastrados em **Administração > Agentes**, sem precisar abrir o Supabase.

## 7. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
```

A variável `SUPABASE_SERVICE_ROLE_KEY` é usada exclusivamente pelas rotas administrativas do servidor para criar e editar usuários do Supabase Auth.

Nunca coloque `service_role` em uma variável iniciada por `NEXT_PUBLIC_` e nunca use essa chave em componentes com `"use client"`.

## 8. Rodar no computador

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## 9. O que já existe neste MVP

- estrutura PWA;
- login com Supabase Auth;
- separação agente/admin;
- proteção das rotas internas no servidor;
- área inicial do agente;
- formulário de fiscalização;
- placa normalizada;
- tipo de veículo;
- foto pela câmera/navegador;
- captura de GPS;
- equipe obtida pela escala ativa;
- salvamento da fiscalização no Supabase;
- foto no Supabase Storage;
- expiração de foto em 60 dias;
- armazenamento básico offline no IndexedDB;
- dashboard administrativo inicial;
- gestão administrativa de agentes;
- cadastro de login + perfil do agente em uma única tela;
- edição de nome, matrícula, e-mail, jornada e senha;
- ativação/desativação sem apagar histórico;
- vínculo do agente com uma ou mais equipes;
- logs básicos de criação/alteração de agentes;
- gestão de escalas e plantões pelo painel;
- plantões padronizados de 07h a 07h;
- turnos de agente 07h–19h, 19h–07h e 07h–07h;
- bloqueio de conflito de horários entre equipes;
- cancelamento de plantão sem apagar histórico;
- substituição de composição da escala preservando versões anteriores;
- tabelas de agentes, equipes, escalas, plantões, veículos, infrações, fiscalizações, fotos e auditoria;
- RLS inicial.

## 10. Próximas etapas recomendadas

1. Carregar a lista real de infrações no formulário.
2. Implementar sincronização completa da fila offline, incluindo fotos.
3. Criar a Edge Function de exclusão automática das fotos vencidas.
4. Criar busca por placa e tela de reincidência.
5. Criar mapa com MapLibre/OpenStreetMap.
6. Criar gráficos reais de produtividade por equipe e por agente.
7. Criar relatórios PDF/CSV.
8. Ampliar a tela de auditoria.
9. Revisar as políticas RLS antes de uso oficial.

## 11. Padrão de código

O projeto foi iniciado com foco em legibilidade:

- nomes de variáveis descritivos;
- funções curtas;
- responsabilidades separadas;
- comentários em português nos pontos importantes;
- nenhuma chave secreta embutida no código;
- SQL separado do frontend.

Ao continuar o projeto, mantenha esse padrão.

## 12. Cadastro de agentes pelo painel

Depois de configurar `SUPABASE_SERVICE_ROLE_KEY`, acesse:

```text
/admin/agentes
```

O administrador pode:

- cadastrar agente e login;
- definir matrícula;
- escolher jornada de 12h ou 24h;
- vincular uma ou mais equipes;
- editar e-mail;
- definir uma nova senha;
- ativar ou desativar o acesso;
- manter o histórico mesmo após desativação.

A chave `service_role` nunca é enviada ao navegador. O formulário chama rotas internas em `/api/admin/agents`, que primeiro confirmam que a sessão pertence a um administrador ativo.


## 13. Escalas e plantões pelo painel

Depois de executar `supabase/005_shift_management.sql`, acesse:

```text
/admin/escalas
```

O administrador pode:

- criar um plantão de uma equipe de 07h até 07h do dia seguinte;
- adicionar agentes de 12h no período 07h–19h;
- adicionar agentes de 12h no período 19h–07h;
- adicionar agentes de 24h no período 07h–07h;
- editar a composição de um plantão;
- trocar agentes preservando a versão anterior no histórico;
- cancelar um plantão sem excluir os dados;
- impedir que o mesmo agente seja escalado simultaneamente em equipes diferentes.

A data e a equipe ficam bloqueadas durante a edição de um plantão existente. Se esses dois dados estiverem errados, cancele o plantão e crie outro. Isso evita alterar o significado histórico de fiscalizações já vinculadas ao plantão.
