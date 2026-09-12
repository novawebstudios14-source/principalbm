import Link from "next/link";
import {
  Users,
  Target,
  Flame,
  MessageSquare,
  Headphones,
  Sparkles,
  Plus,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireMember, customerScope, canManage } from "@/lib/access";
import { PageHeader, CustomerLink } from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
import { OpportunitiesTable } from "@/components/opportunities-table";
import { date } from "@/lib/format";
export default async function Dashboard() {
  const actor = await requireMember(),
    scope = customerScope(actor);
  const open = {
    customer: scope,
    status: {
      notIn: ["CONVERTED", "LOST", "IGNORED"] as (
        | "CONVERTED"
        | "LOST"
        | "IGNORED"
      )[],
    },
  };
  const [customers, opportunities, high, approval, service, recent, replies] =
    await Promise.all([
      db.customer.count({ where: scope }),
      db.opportunity.count({ where: open }),
      db.opportunity.count({ where: { ...open, priority: "Alta" } }),
      db.opportunity.count({ where: { customer: scope, status: "APPROVAL" } }),
      db.conversation.count({
        where: { customer: scope, status: "HUMAN_SERVICE" },
      }),
      db.opportunity.findMany({
        where: { customer: scope },
        include: {
          customer: { include: { owner: { include: { user: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 7,
      }),
      db.conversation.findMany({
        where: { customer: scope, status: "HUMAN_SERVICE" },
        include: { customer: true },
        orderBy: { repliedAt: "desc" },
        take: 3,
      }),
    ]);
  const cards = [
    [
      "Clientes cadastrados",
      customers,
      Users,
      "/clientes",
      "Histórias que acompanhamos",
    ],
    [
      "Oportunidades abertas",
      opportunities,
      Target,
      "/oportunidades",
      "Próximos contatos",
    ],
    [
      "Alta prioridade",
      high,
      Flame,
      "/oportunidades?priority=Alta",
      "Momentos importantes",
    ],
    [
      "Aguardando aprovação",
      approval,
      MessageSquare,
      "/mensagens-para-aprovar",
      "Mensagens para revisar",
    ],
    [
      "Atendimento necessário",
      service,
      Headphones,
      "/atendimento",
      "Clientes que responderam",
    ],
  ] as const;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`${date(new Date())} · Acompanhe os próximos momentos das suas clientes.`}
      >
        {actor.role !== "MARKETING" && (
          <Link className="button-link" href="/clientes?novo=1">
            <Plus size={17} />
            Nova cliente
          </Link>
        )}
      </PageHeader>
      <div className="stats">
        {cards.map(([label, value, Icon, href, sub]) => (
          <Link className="stat" href={href} key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon className="stat-icon" size={18} />
            </div>
            <strong>{value}</strong>
            <small>{sub}</small>
          </Link>
        ))}
      </div>
      <div className="journey-strip">
        <Sparkles size={24} />
        <div>
          <h3>O momento certo faz a diferença</h3>
          <p>
            Gestação, crescimento e histórico de compras orientam cada
            oportunidade.
          </p>
        </div>
        {canManage(actor) && (
          <ActionForm kind="evaluate" className="inline">
            <Submit variant="outline">Avaliar jornadas</Submit>
          </ActionForm>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Oportunidades recentes</h2>
            <p>Entenda o motivo antes de iniciar a conversa.</p>
          </div>
          <Link href="/oportunidades" className="text-link">
            Ver todas
          </Link>
        </div>
        <OpportunitiesTable rows={recent} />
      </section>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Precisam de você</h2>
            <Link className="text-link" href="/atendimento">
              Abrir atendimento
            </Link>
          </div>
          {replies.length ? (
            <ul className="simple-list">
              {replies.map((c) => (
                <li key={c.id}>
                  <CustomerLink
                    id={c.customerId}
                    name={c.customer.name}
                    sub="Cliente respondeu · automação interrompida"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-body">
              <p className="muted">Nenhuma resposta aguardando atendimento.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Contato com cuidado</h2>
          </div>
          <div className="panel-body">
            <p className="section-note">
              A equipe aprova a primeira mensagem. Quando a cliente responde, o
              relacionamento continua com uma pessoa da loja.
            </p>
            <Link href="/configuracoes" className="text-link">
              Ver configuração de mensagens →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
