import type { Opportunity } from "@prisma/client";
import { CustomerLink, Empty, Badge, Status } from "./ui";
type Row = Opportunity & {
  customer: { id: string; name: string; owner: { user: { name: string } } };
};
export function OpportunitiesTable({ rows }: { rows: Row[] }) {
  if (!rows.length)
    return (
      <Empty
        title="Nenhuma oportunidade por aqui"
        detail="Cadastre as jornadas das clientes e execute a avaliação para identificar os próximos contatos."
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Motivo</th>
            <th>Prioridade</th>
            <th>Score</th>
            <th>Responsável</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((op) => (
            <tr key={op.id}>
              <td>
                <CustomerLink id={op.customerId} name={op.customer.name} />
              </td>
              <td>
                {op.reason}
                <span className="subtext">{op.category}</span>
              </td>
              <td>
                <Badge
                  tone={
                    op.priority === "Alta"
                      ? "pink"
                      : op.priority === "Média"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {op.priority}
                </Badge>
              </td>
              <td>
                <span className="score" title={op.scoreReason}>
                  {op.score}
                  <small>/100</small>
                </span>
              </td>
              <td>{op.customer.owner.user.name}</td>
              <td>
                <Status value={op.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
