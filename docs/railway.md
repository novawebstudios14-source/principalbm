# Publicação no Railway

Configuração planejada para o repositório `novawebstudios14-source/principalbm`, branch `main`.

| Serviço | Configuração |
| --- | --- |
| PostgreSQL | Banco persistente, acessível pela rede privada |
| Web | Instalar dependências incluindo desenvolvimento, executar `npm run build`, migrar com `npm run db:migrate`, iniciar com `npm start` |
| Worker | Mesmo código e dependências, iniciar com `npm run worker:production`; sem domínio público |

Definir `DATABASE_URL` por referência ao PostgreSQL nos dois serviços. Definir `NODE_ENV=production`, `BETTER_AUTH_SECRET` aleatório e `BETTER_AUTH_URL` com o domínio HTTPS real. Manter `WHATSAPP_TRANSPORT=disabled` e `DEV_REPLY_ENABLED=false`. O worker precisa de `tsx` instalado; não remover dependências de desenvolvimento neste MVP.

Criar a conta inicial em execução pontual com `npm run admin:create:production`, usando nome, e-mail e senha de acesso definidos para a instalação. Remover as variáveis de provisionamento depois. Não executar seed em produção.

Os comandos de produção leem as variáveis fornecidas pela hospedagem e não exigem arquivo `.env`.

Após a publicação: verificar login, sessão, conexão com banco, migrações e processamento de jornadas. A publicação depende da conexão da conta Railway; este arquivo não indica que os serviços já existem.
