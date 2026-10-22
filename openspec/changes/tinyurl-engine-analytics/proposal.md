# Proposal

## Why

O projeto ainda não oferece um serviço de encurtamento de links. Esta mudança estabelece um backend enxuto que redireciona rapidamente para a URL original e registra cliques para consulta posterior.

## What Changes

- Criar links curtos com slug único de seis caracteres.
- Redirecionar por `/r/{slug}` com HTTP 302 e registrar timestamp, user-agent e referrer em SQLite.
- Expor consulta do total de cliques por link.
- Criar uma interface para encurtar, copiar e acompanhar links, atualizando as contagens de cliques periodicamente.
- Definir respostas para URLs inválidas e slugs inexistentes.

## Capabilities

### New Capabilities
- `tinyurl-analytics`: criação e redirecionamento de links, consulta de cliques e interface de acompanhamento.

### Modified Capabilities
- Nenhuma.

## Impact

- Nova aplicação em Node.js + TypeScript, com API Fastify, interface React/Vite e persistência SQLite assíncrona; o workspace atualmente não contém aplicação nem camada de dados.
- Contratos propostos: `POST /api/links` recebe uma URL e retorna slug e URL curta; `GET /r/{slug}` redireciona; `GET /api/links/{slug}/analytics` retorna a contagem total de cliques.
- A interface guarda os slugs criados pelo navegador localmente e consulta as métricas periodicamente; não há listagem global sem autenticação.