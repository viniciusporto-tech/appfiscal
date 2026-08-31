# AppFiscal Cabo Frio — v5

Sistema interno de fiscalização com painel administrativo Next.js, PWA/área do agente, Supabase e app mobile Expo.

## Recursos principais

### Fiscalização em campo
- foto enviada diretamente ao Supabase Storage;
- compressão da foto antes do upload no PWA;
- placa, **Carro / Ônibus / Van / Táxi / Moto / Micro-ônibus / Outro**;
- infrações filtradas automaticamente pelo tipo de veículo;
- GPS + endereço;
- resultado: não multado, Guarda Municipal ou Fiscal;
- fila offline e sincronização;
- consulta de veículo, reincidência e autorizações;
- decretos em PDF.

### Administração
- dashboard;
- fiscalizações e fotos;
- veículos e histórico por placa;
- veículos autorizados e tipos de serviço;
- equipes, agentes e escalas;
- infrações gerais ou específicas por tipo de veículo;
- decretos;
- mapa, auditoria e configurações;
- relatórios personalizados.

## Relatórios personalizados

Em **Admin → Relatórios**, escolha:

- relatório de **Fiscalizações** ou **Veículos**;
- data inicial/final;
- placa;
- tipo de veículo;
- infração;
- equipe/agente/resultado (fiscalizações);
- empresa, reincidência e autorização (veículos);
- exatamente quais colunas entram no arquivo.

Saídas: **Excel (.xlsx), PDF e CSV**.

## Infrações específicas

Em **Admin → Infrações**, um cadastro com nenhum tipo marcado vale para todos. Se marcar tipos, a infração aparece somente para os selecionados, por exemplo:

- apenas Táxi;
- Ônibus + Micro-ônibus;
- Van;
- Táxi + Van + Ônibus.

A regra também é validada no Supabase, não apenas na tela.

## Atualização do banco existente

Execute apenas:

`supabase/ATUALIZACAO_V5_EXISTENTE.sql`

Para detalhes de instalação, leia **COMECE_AQUI.md**.
