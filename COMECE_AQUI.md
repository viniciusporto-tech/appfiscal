# APPFISCAL v5 — COMEÇE AQUI

Esta pasta já reúne a versão PRO do painel, a área do agente, veículos autorizados, decretos e as melhorias de custo/segurança.

## 1. Atualize o banco existente

No Supabase, abra **SQL Editor → New query** e execute inteiro:

`supabase/ATUALIZACAO_V5_EXISTENTE.sql`

Esse arquivo é a atualização única desta versão. Ele:

- mantém os dados já existentes;
- adiciona resultado da abordagem e recursos da versão PRO quando ainda faltarem;
- adiciona veículos autorizados;
- adiciona decretos em PDF;
- adiciona suporte ao app mobile/offline;
- troca dados antigos de **Automóvel** para **Carro**;
- permite infrações específicas por tipo de veículo;
- cria índices para filtros/relatórios;
- reforça a validação de plantão e de infração no próprio banco.

> Não apague suas tabelas e não rode novamente o schema inicial se o sistema já estiver em uso.

## 2. Variáveis de ambiente do painel web

Crie `.env.local` na raiz copiando `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

A `SUPABASE_SERVICE_ROLE_KEY` é somente servidor. Nunca coloque `NEXT_PUBLIC_` nela.

## 3. Instale e teste no Windows

```powershell
npm.cmd install
npm.cmd run dev -- -H 0.0.0.0
```

Abra `http://localhost:3000`.

Só depois de testar faça push para a branch `main`, reduzindo Production Deploys da Netlify.

## 4. O que testar primeiro

1. **Admin → Infrações**: crie uma infração e marque somente Táxi.
2. **Agente → Nova fiscalização**: escolha Carro e confirme que a infração de Táxi não aparece; escolha Táxi e confirme que aparece.
3. Tire uma foto: a tela informa o tamanho após a compressão.
4. **Admin → Relatórios**: escolha Fiscalizações ou Veículos, filtros e apenas as colunas desejadas; gere Excel/PDF/CSV.
5. **Admin → Decretos**: envie um PDF e abra pelo usuário agente.
6. Verifique Veículos autorizados e consulta por placa.

## 5. Netlify

Use estas variáveis em **Site configuration → Environment variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

O projeto envia fotos de fiscalização diretamente para o Supabase Storage; elas não passam por uma Function da Netlify.

## 6. App mobile

O ZIP mobile desta entrega já usa **Carro**, filtra infrações por tipo de veículo, reduz a qualidade da foto antes do envio, possui Decretos e inclui um script de configuração que instala também as dependências Web do Expo.
