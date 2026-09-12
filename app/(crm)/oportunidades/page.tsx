import { db } from "@/lib/db";
import { requireMember, customerScope, canManage } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { OpportunitiesTable } from "@/components/opportunities-table";
import { ActionForm, Submit } from "@/components/form";
import { OpportunityStatus } from "@prisma/client";
import { statusLabel } from "@/lib/format";
export default async function Opportunities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requireMember(),
    params = await searchParams;
  const status = Object.values(OpportunityStatus).find(
    (v) => v === params.status,
  );
  const rows = await db.opportunity.findMany({
    where: {
      customer: customerScope(actor),
      ...(status
        ? { status }
        : { status: { notIn: ["CONVERTED", "LOST", "IGNORED"] } }),
      ...(["Alta", "Média", "Baixa"].includes(params.priority ?? "")
        ? { priority: params.priority }
        : {}),
    },
    include: { customer: { include: { owner: { include: { user: true } } } } },
    orderBy: { score: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Um motivo claro para iniciar cada conversa."
      >
        {canManage(actor) && (
          <ActionForm kind="evaluate">
            <Submit>Avaliar jornadas</Submit>
          </ActionForm>
        )}
      </PageHeader>
      <form className="filterbar">
        <select
          aria-label="Status"
          name="status"
          defaultValue={params.status ?? ""}
        >
          <option value="">Todas as abertas</option>
          {Object.values(OpportunityStatus).map((v) => (
            <option key={v} value={v}>
              {statusLabel[v]}
            </option>
          ))}
        </select>
        <select
          aria-label="Prioridade"
          name="priority"
          defaultValue={params.priority ?? ""}
        >
          <option value="">Todas as prioridades</option>
          {["Alta", "Média", "Baixa"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button className="button-link secondary">Filtrar</button>
        <span className="count">
          {rows.length} oportunidades · até 200 por consulta
        </span>
      </form>
      <section className="panel">
        <OpportunitiesTable rows={rows} />
      </section>
    </>
  );
}
