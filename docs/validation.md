# Validação do MVP

Verificações realizadas em 12/09/2026:

- Compilação de produção Next.js e TypeScript estrito.
- Quatro testes de regras: cenário Mariana/DPP 10/11/2026, idade e fim de mês, eventos futuros/gestação encerrada e score limitado.
- Migrações aplicadas em um banco PostgreSQL embarcado PGlite efêmero.
- Integração de domínio: evento e oportunidade únicos após reprocessamento, somente uma aprovação concorrente, isolamento de organização e vendedor, marketing sem escrita, estado pendente com transporte desabilitado, deduplicação da resposta e bloqueio após resposta.
- Worker: agendamento diário único, disputa de lease, entrega explicitamente simulada e interrupção após resposta. Instantes usam TIMESTAMPTZ; datas civis usam DATE.
- Assinatura HMAC inválida rejeitada; resposta assinada aceita.
- Teste HTTP contra a aplicação compilada: senha inválida rejeitada, login, sete rotas protegidas, cadastro, gestação, avaliação duas vezes, edição da sugestão, aprovação, resposta persistida, fila de atendimento, compra vinculada, conversão, nota, encerramento e logout com invalidação da sessão.

Os testes usam dados isolados e credenciais efêmeras. Não houve envio de mensagens externas. O teste HTTP verifica HTML servido e Server Actions; não substitui inspeção visual em navegador.

PGlite serializa conexões. O workflow de CI inclui a integração em PostgreSQL 17 com cinco conexões para testar os bloqueios reais; seu resultado depende da execução no GitHub. O ambiente local não validou essa execução dedicada.

WhatsApp real e hospedagem de produção não foram configurados. A abstração de transporte e o webhook HMAC estão disponíveis; a integração nativa de um provedor continua necessária.
