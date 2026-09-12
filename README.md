# Principal — CRM materno e infantil

MVP em PT-BR para acompanhar clientes, gestação, filhos e compras. Marcos da jornada geram oportunidades com pontuação explicada. A equipe edita e aprova o primeiro WhatsApp. Uma resposta interrompe a automação e abre atendimento humano.

## Arquitetura

Next.js 16 / React 19 / TypeScript estrito, Prisma 6, PostgreSQL e Better Auth. Server Actions validam os formulários e verificam permissões. Worker persistido em PostgreSQL, sem Redis e sem dependência de IA. [Decisões e referência Comp AI](docs/architecture.md).

Este repositório é independente de `trycompai/crm`. O Button e os padrões adaptados preservam a atribuição MIT em [LICENSE-COMP-AI](LICENSE-COMP-AI).

## Executar localmente

Requisitos: Node.js 22.12+ e PostgreSQL 17 (ou Docker Compose).

```bash
npm ci
cp .env.example .env
docker compose up -d db
npm run db:generate
npm run db:migrate
```

Edite `.env`: configure `DATABASE_URL`, `BETTER_AUTH_URL` e um `BETTER_AUTH_SECRET` aleatório de pelo menos 32 caracteres. Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres), `ADMIN_NAME` e `BUSINESS_NAME`.

```bash
npm run admin:create
# Opcional, somente para desenvolvimento:
npm run db:seed
npm run dev
# Em outro terminal:
npm run worker
```

Abra `http://localhost:3000` e entre com a conta criada. Não há senha padrão nem cadastro público. O administrador inicial recebe o cargo de proprietário. O seed cria seis clientes demonstrativas e uma resposta simulada; não envia mensagens externas. Execute apenas em um banco de desenvolvimento.

Para criar outra pessoa na mesma loja, configure `ADMIN_ORGANIZATION_ID` com o identificador exibido na criação, `ADMIN_ROLE` (`OWNER`, `MANAGER`, `SELLER` ou `MARKETING`) e os novos dados `ADMIN_*`; execute `admin:create`. Contas existentes não são sobrescritas. Sem `ADMIN_ORGANIZATION_ID`, uma nova loja independente é criada. O MVP usa a primeira associação da conta e não oferece troca de loja na interface. Remova a senha de provisionamento do ambiente após criar a conta.

## Permissões

| Perfil                 | Acesso                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| Proprietário / gerente | Operação da loja, atribuição de responsáveis, configuração e reprocessamento     |
| Vendedor               | Consulta e alteração somente das próprias clientes, oportunidades e atendimentos |
| Marketing / CRM        | Consulta de clientes, segmentos, oportunidades e filas; sem mutações             |

Autenticação e autorização são verificadas no servidor. O navegador não escolhe a organização. Relacionamentos comerciais usam chaves estrangeiras compostas por organização. Alterações concorrentes são serializadas por cliente.

## Jornadas, score e idempotência

Cinco regras iniciais:

- 7º mês de gestação: semana 28 até antes da 32 (DPP − 84 até DPP − 56 dias).
- Até 30 dias antes da DPP, incluindo o dia previsto.
- Bebê aos 3 e 6 meses: janela de 30 dias após o aniversário mensal.
- 90 dias sem compra: uma vez por última compra; sem compras, conta desde o cadastro.

Meses de crianças são calendários; a idade e a gestação são recalculadas na consulta. Não há recuperação de campanhas muito antigas fora das janelas. Datas de domínio são datas civis UTC e horários do histórico aparecem em São Paulo.

Score: relevância do evento (40, 60, 65 ou 75) + 10 por compra nos últimos 60 dias + 10 por três ou mais compras + 10 por total acumulado ≥ R$ 1.000, limitado a 100. Prioridade alta ≥ 75, média ≥ 50, baixa < 50. O motivo aparece no perfil e na aprovação.

Uma chave única identifica regra e entidade; cada evento possui uma única oportunidade. A transação grava evento, oportunidade e histórico em conjunto. Alterar a DPP não cria outro evento para a mesma regra e gestação. O botão “Avaliar jornada” permite conferir imediatamente; o worker agenda a avaliação diária por organização. Reinícios retomam trabalhos persistidos.

Jobs usam `FOR UPDATE SKIP LOCKED`, lease de cinco minutos, renovação durante avaliações e cinco tentativas com espera exponencial. A configuração mostra erros e permite reprocessar tarefas esgotadas. Provedor desabilitado adia mensagens sem consumir tentativas. Processamentos são idempotentes. Listagens de oportunidades e filas têm limite de 200; histórico/conversa mostram até 100 eventos/mensagens e clientes têm paginação de 30.

## WhatsApp e atendimento

**Não há provedor real implementado ou conectado.** Sem credenciais fornecidas, o MVP entrega a abstração, a fila persistida, o contrato de webhook e o transporte de desenvolvimento. Adicionar apenas uma chave não habilita envio real: é necessário implementar e testar o adaptador do provedor.

| Variável                           | Uso                                                            |
| ---------------------------------- | -------------------------------------------------------------- |
| `WHATSAPP_TRANSPORT=disabled`      | Padrão; aprovações ficam na fila, sem envio externo            |
| `WHATSAPP_TRANSPORT=mock`          | Entrega simulada explícita, bloqueada em produção              |
| `DEV_REPLY_ENABLED=true`           | Exibe simulação de resposta no perfil, apenas fora de produção |
| `WHATSAPP_WEBHOOK_SECRET`          | Segredo HMAC do contrato de webhook                            |
| `WHATSAPP_WEBHOOK_ORGANIZATION_ID` | Loja associada ao webhook; nunca vem do corpo                  |

A fila de aprovação exige permissão de contato registrada no perfil. A aprovação reserva **um único primeiro contato por cliente**, inclusive entre oportunidades diferentes. Não há follow-ups. O envio pendente é cancelado se a permissão for retirada ou a cliente responder. A resposta muda a conversa para atendimento humano e bloqueia a automação permanentemente, mesmo após encerrar o atendimento. Notas e compras registram a continuidade humana; o MVP não envia mensagens humanas pelo provedor.

Webhook do adaptador: `POST /api/whatsapp/webhook`, corpo JSON `{ "phone": "5511999999999", "providerId": "identificador-unico", "body": "Resposta da cliente" }`. Header `x-signature-sha256`: HMAC SHA-256 hexadecimal do corpo bruto usando o segredo. Telefone precisa corresponder a cliente cadastrada. Retentativas do mesmo `providerId` são ignoradas. Assinatura inválida retorna 401; não configurado retorna 503. **Este não é o formato nativo do webhook da Meta.** Um futuro adaptador deve verificar o webhook nativo, normalizar respostas, tratar status de entrega e usar templates aprovados quando exigido pelo provedor.

## Testes

```bash
npm test
npm run typecheck
npm run test:integration
npm run build
npm run test:http
```

`test:http` inicia a versão compilada em um banco efêmero e verifica login/logout, rotas protegidas e o cenário completo por requisições HTTP e Server Actions. Não é um teste visual de navegador.

`test:integration` usa o banco configurado e cria/remove uma organização própria; execute em banco de teste. Verifica evento/oportunidade únicos, aprovação concorrente, escopos, resposta duplicada, cancelamento, bloqueio após resposta e HMAC.

`npm run test:local` executa as migrações e a integração em PostgreSQL embarcado PGlite efêmero. Esse ambiente serializa conexões e não substitui uma validação de concorrência em PostgreSQL de produção. `npm run db:dev` disponibiliza PGlite persistente para desenvolvimento em `127.0.0.1:5433`; use `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?schema=public&sslmode=disable&connection_limit=1&statement_cache_size=0&pgbouncer=true`. Não use PGlite como banco de produção.

## Cenário de aceite

1. Entre e cadastre Mariana Souza com telefone e permissão de contato.
2. Registre DPP `10/11/2026` e avalie a jornada. Em `11/09/2026` ela está na 31ª semana e gera o evento do 7º mês. O teste automatizado fixa essa data; em outras datas os eventos dependem das janelas descritas.
3. Reavalie e confirme uma única oportunidade para o evento.
4. Abra Mensagens para aprovar, edite, salve a edição e aprove.
5. No perfil, confira a mensagem na fila; em modo mock, processe pelo worker ou botão de teste.
6. Simule uma resposta. Confira a fila Atendimento e o histórico. Novas tentativas automáticas ficam bloqueadas.
7. Registre uma compra vinculada à oportunidade para convertê-la; registre notas e encerre o atendimento quando apropriado.

## Produção e próximos passos

```bash
npm ci
npm run db:migrate
npm run build
npm start
# Processo supervisionado separado:
npm run worker
```

Configure PostgreSQL persistente, URL HTTPS e segredo de sessão. Use `NODE_ENV=production` também no worker, HTTPS no proxy e backups do banco. Não exponha a porta do PostgreSQL. Não publique `.env`.

Limitações: sem envio WhatsApp real, recuperação de senha por e-mail, convites pela interface, seleção de organização, edição de filhos após cadastro, campanhas, ERP ou catálogo. O primeiro contato é conservador: apenas um por cliente, sem reinício automático. A próxima etapa é escolher o provedor WhatsApp, implementar templates e webhooks nativos e validar concorrência e recuperação de falhas em PostgreSQL dedicado.
