# Decisões do MVP

Referência inspecionada: trycompai/crm, commit 6d4793dd6d7aeea91aa6a034e00b17d7408a2d08 (MIT). O repositório principalbm estava vazio.

Mantidos Next.js App Router, React, TypeScript, Prisma/PostgreSQL e Better Auth com adaptador Prisma. O componente Button deriva de packages/ui, com licença preservada. Tabelas com filtros na URL, formulários validados no servidor e atividades cronológicas adaptam os padrões de contacts-table, saved-view, activity-composer e Activity. A fila usa o padrão de lease SQL / SKIP LOCKED inspecionado em apps/agent/agent/lib/tasks.ts.

Simplificações: uma aplicação Next em vez de monorepo Nest/tRPC; Server Actions tipadas substituem a API tRPC entre a interface e o servidor. Não são portados agentes, enriquecimento B2B, Slack, e-mail, campos genéricos ou pesquisa de empresas. Better Auth usa e-mail/senha para equipe interna, sem cadastro público; organizações e cargos são geridos no domínio. Gestação e filhos são entidades relacionais próprias. Todas as relações comerciais usam chaves compostas por organização.

Visual: superfície operacional branca, navegação azul-marinho, acentos framboesa, tabelas compactas e jornadas legíveis. Sem imagens decorativas ou painel B2B.

Jornadas e aprovação serializam operações por cliente com bloqueio PostgreSQL. Eventos têm chave única por entidade, regra e marco; cada evento cria no máximo uma oportunidade. Uma conversa por cliente protege contra primeiros contatos automáticos repetidos, inclusive entre oportunidades. Uma resposta bloqueia permanentemente a automação nessa conversa. Não há sequências ou follow-ups automáticos.

Não há credenciais de WhatsApp fornecidas. O adaptador disponível é desabilitado/mock, sem alegar conexão real. Uma integração de provedor real requer implementar o adaptador e mapear o webhook nativo, respeitando assinatura, templates e identificadores idempotentes do provedor. O webhook atual é o contrato HMAC do adaptador, não um endpoint Meta compatível.
