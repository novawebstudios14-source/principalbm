import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember, customerScope } from "@/lib/access";
import { PageHeader, CustomerLink, Empty, Badge } from "@/components/ui";
import { datetime } from "@/lib/format";
export default async function Service() {
  const actor = await requireMember();
  const rows = await db.conversation.findMany({
    where: { customer: customerScope(actor), status: "HUMAN_SERVICE" },
    include: {
      customer: { include: { owner: { include: { user: true } } } },
      messages: {
        where: { direction: "INBOUND" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { opportunity: true },
      },
    },
    orderBy: { repliedAt: "asc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Atendimento necessário"
        description="Elas responderam. Agora é a vez da sua equipe."
      />
      {rows.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Última resposta</th>
                  <th>Responsável</th>
                  <th>Aguardando desde</th>
                  <th>Atendimento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <CustomerLink id={c.customerId} name={c.customer.name} />
                    </td>
                    <td>
                      {c.messages[0]?.body}
                      <span className="subtext">
                        {c.messages[0]?.opportunity?.reason ??
                          "Contato da cliente"}
                      </span>
                    </td>
                    <td>{c.customer.owner.user.name}</td>
                    <td>
                      {c.repliedAt && datetime(c.repliedAt)}
                      <span className="subtext">
                        Há{" "}
                        {Math.max(
                          0,
                          Math.floor(
                            (Date.now() -
                              (c.repliedAt?.getTime() ?? Date.now())) /
                              60000,
                          ),
                        )}{" "}
                        minutos
                      </span>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/clientes/${c.customerId}`}
                      >
                        Abrir conversa →
                      </Link>
                      <span className="subtext">
                        <Badge tone="blue">Automação interrompida</Badge>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel">
          <Empty
            title="Nenhum atendimento pendente"
            detail="Quando uma cliente responder, ela aparecerá aqui e a automação será interrompida."
          />
        </section>
      )}
    </>
  );
}
